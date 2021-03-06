'use strict';

exports.__esModule = true;
exports.send = undefined;
exports.extractState = extractState;
exports.generateId = generateId;
exports.start = start;
exports.connect = connect;
exports.connectViaExtension = connectViaExtension;

var _jsan = require('jsan');

var _socketclusterClient = require('socketcluster-client');

var _socketclusterClient2 = _interopRequireDefault(_socketclusterClient);

var _rnHostDetect = require('rn-host-detect');

var _rnHostDetect2 = _interopRequireDefault(_rnHostDetect);

var _constants = require('./constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var socket = void 0;
var channel = void 0;
var listeners = {};

function extractState(message) {
  if (!message || !message.state) return undefined;
  if (typeof message.state === 'string') return (0, _jsan.parse)(message.state);
  return message.state;
}

function generateId() {
  return Math.random().toString(36).substr(2);
}

function handleMessages(message) {
  if (!message.payload) message.payload = message.action;
  Object.keys(listeners).forEach(function (id) {
    if (message.instanceId && id !== message.instanceId) return;
    if (typeof listeners[id] === 'function') listeners[id](message);else listeners[id].forEach(function (fn) {
      fn(message);
    });
  });
}

function watch() {
  if (channel) return;
  socket.emit('login', 'master', function (err, channelName) {
    if (err) {
      console.log(err);return;
    }
    channel = socket.subscribe(channelName);
    channel.watch(handleMessages);
    socket.on(channelName, handleMessages);
  });
}

function connectToServer(options) {
  if (socket) return;
  var socketOptions = void 0;
  if (options.port) {
    socketOptions = {
      port: options.port,
      hostname: (0, _rnHostDetect2.default)(options.hostname || 'localhost'),
      secure: !!options.secure
    };
  } else socketOptions = _constants.defaultSocketOptions;
  socket = _socketclusterClient2.default.connect(socketOptions);
  watch();
}

function start(options) {
  if (options) {
    if (options.port && !options.hostname) {
      options.hostname = 'localhost';
    }
  }
  connectToServer(options);
}

function transformAction(action, config) {
  if (action.action) return action;
  var liftedAction = { timestamp: Date.now() };
  if (action) {
    if (config.getActionType) liftedAction.action = config.getActionType(action);else {
      if (typeof action === 'string') liftedAction.action = { type: action };else if (!action.type) liftedAction.action = { type: 'update' };else liftedAction.action = action;
    }
  } else {
    liftedAction.action = { type: action };
  }
  return liftedAction;
}

function _send(action, state, options, type, instanceId) {
  start(options);
  setTimeout(function () {
    var message = {
      payload: state ? (0, _jsan.stringify)(state) : '',
      action: type === 'ACTION' ? (0, _jsan.stringify)(transformAction(action, options)) : action,
      type: type || 'ACTION',
      id: socket.id,
      instanceId: instanceId,
      name: options.name
    };
    socket.emit(socket.id ? 'log' : 'log-noid', message);
  }, 0);
}

exports.send = _send;
function connect() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var id = generateId(options.instanceId);
  start(options);
  return {
    init: function init(state, action) {
      _send(action || {}, state, options, 'INIT', id);
    },
    subscribe: function subscribe(listener) {
      if (!listener) return undefined;
      if (!listeners[id]) listeners[id] = [];
      listeners[id].push(listener);

      return function unsubscribe() {
        var index = listeners[id].indexOf(listener);
        listeners[id].splice(index, 1);
      };
    },
    unsubscribe: function unsubscribe() {
      delete listeners[id];
    },
    send: function send(action, payload) {
      if (action) {
        _send(action, payload, options, 'ACTION', id);
      } else {
        _send(undefined, payload, options, 'STATE', id);
      }
    },
    error: function error(payload) {
      socket.emit({ type: 'ERROR', payload: payload, id: socket.id, instanceId: id });
    }
  };
}

function connectViaExtension(options) {
  if (options && options.remote || typeof window === 'undefined' || !window.devToolsExtension) {
    return connect(options);
  }
  return window.devToolsExtension.connect(options);
}

exports.default = { connect: connect, connectViaExtension: connectViaExtension, send: _send, extractState: extractState, generateId: generateId };