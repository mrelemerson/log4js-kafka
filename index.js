const debug = require('debug')('log4js:kafka');
const { Kafka } = require('kafkajs');

function kafkaAppender(config, layout) {
  const kafka = new Kafka({
    clientId: config.clientId,
    brokers: config.brokers,
    ssl: config.ssl
  });
  
  const { topic, shutdownTimeout = 10000 } = config;
  const messagesToSend = [];
  let promisesWaiting = 0;
  let waitingToConnect = true;
  let connection;

  const send = (messages) => {
    const rn = connection.send({
      topic,
      messages: messages.map((message) => ({ value: message })),
    });
    messages.length = 0; // eslint-disable-line
    promisesWaiting += 1;
    debug(`Promises waiting: ${promisesWaiting}`);
    rn.then(() => {
      promisesWaiting -= 1;
      debug(`Promise resolved. Waiting is now: ${promisesWaiting}`);
    });
  };

  const publish = (message) => {
    if (message) {
      messagesToSend.push(message);
      debug(`Added message to buffer. Buffer length: ${messagesToSend.length}`);
    }
    if (!waitingToConnect && connection && messagesToSend.length > 0) {
      debug('Sending buffer.');
      send(messagesToSend);
    }
  };

  const closeConnection = (done) => {
    if (connection) {
      connection.disconnect().then(done);
      return;
    }
    done();
  };

  const waiting = () => waitingToConnect || promisesWaiting > 0 || messagesToSend.length > 0;

  const waitForPromises = (done) => {
    let howLongWaiting = 0;
    const checker = () => {
      debug(`waitingToConnect? ${waitingToConnect}`);
      publish();
      if (howLongWaiting >= shutdownTimeout) {
        debug(`Done waiting for promises. Waiting: ${promisesWaiting}`);
        closeConnection(done);
        return;
      }
      if (waiting()) {
        debug('Things to wait for.');
        howLongWaiting += 50;
        setTimeout(checker, 50);
      } else {
        debug('Nothing to wait for, shutdown now.');
        closeConnection(done);
      }
    };
    checker();
  };

  (async (producer) => {
    try {
      await producer.connect();
      connection = producer;
      waitingToConnect = false;
      debug('Connected.');
      publish();
    } catch (e) {
      debug('connect failed.');
      waitingToConnect = false;
      console.error(e);
      process.exit(1);
    }
  })(kafka.producer());

  const appender = (loggingEvent) => publish(layout(loggingEvent));

  appender.shutdown = (done) => {
    debug('Appender shutdown.');
    debug(`waitingToConnect: ${waitingToConnect},
      messagesToSend: ${messagesToSend},
      promisesWaiting: ${promisesWaiting}`);
    waitForPromises(done);
  };

  return appender;
}

function stdoutAppender(config, layout) {
  // This is the appender function itself
  return (loggingEvent) => {
    process.stdout.write(`${layout(loggingEvent, config.timezoneOffset)}\n`);
  };
}

const map = new Map();

map.set('stdout', (config, layouts) => {
  let layout = config.layout ?
    layouts.layout(config.layout.type, config.layout) :
    layouts.colouredLayout;

  return stdoutAppender(config, layout);
});
map.set('log4js-kafka', (config, layouts) => {
  let layout = config.layout ?
    layouts.layout(config.layout.type, config.layout) :
    layouts.messagePassThroughLayout;

  return kafkaAppender(config, layout);
});

// eslint-disable-next-line import/prefer-default-export
exports.configure = (config, layouts) => {
  const appender = process.env.DL4K === '0' ? 
    map.get('stdout') : 
    map.get('log4js-kafka');
  
  return appender(config, layouts);
};
