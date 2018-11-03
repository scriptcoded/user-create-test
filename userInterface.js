const net = require('net')
const JsonSocket = require('json-socket')
const uuid = require('uuid/v4')

let socket

let conversations = {}

function connect () {
  return new Promise((resolve, reject) => {
    socket = new JsonSocket(new net.Socket())
    socket.connect('/var/run/nodeUser.sock')

    socket.on('connect', () => {
      resolve()
    })

    socket.on('message', message => {
      let conversation = conversations[message.ref]

      if (!conversation) {
        return
      }

      if (message.status === 'error') {
        return conversation.reject(message)
      }

      if (!message.responseTo) {
        return
      }

      switch (message.responseTo) {
        default:
          conversation.resolve(message)
          break
      }
    })
  })
}

module.exports.userExists = username => {
  connect()

  return new Promise((resolve, reject) => {
    let id = uuid()
    conversations[id] = {
      status: 'waiting',
      action: 'check',
      resolve,
      reject
    }
    socket.sendMessage({
      ref: id,
      action: conversations[id].action,
      username: username
    })
  })
}

module.exports.createUser = (username, password = '') => {
  connect()

  return new Promise((resolve, reject) => {
    let id = uuid()
    conversations[id] = {
      status: 'waiting',
      action: 'create',
      resolve,
      reject
    }
    socket.sendMessage({
      ref: id,
      action: conversations[id].action,
      username: username,
      password: password
    })
  })
}

module.exports.createUserIncrement = async (desiredUsername, password) => {
  try {
    return await module.exports.createUser(desiredUsername, password)
  } catch (e) {
    if (e.code === 'userExists') {
      const usernamesResult = await module.exports.getUsernames()

      if (usernamesResult.status === 'error') {
        return usernamesResult
      }

      const username = usernamesResult.usernames
        .filter(username => username.match(new RegExp(`^${desiredUsername}-[0-9]*$`)))
        .sort((a, b) => b.match(/-[0-9]*$/)[0] > a.match(/-[0-9]*$/)[0])[0] ||
        desiredUsername
      const baseUsername = username.replace(/-[0-9]*$/, '')
      const usernameNumber = parseInt((username.match(/-([0-9]*)$/) || [])[1] || 0) + 1

      const newUsername = `${baseUsername}-${usernameNumber}`

      try {
        return await module.exports.createUser(newUsername, password)
      } catch (e) {
        throw e
      }
    }
  }
}

module.exports.getUsers = () => {
  connect()

  return new Promise((resolve, reject) => {
    let id = uuid()
    conversations[id] = {
      status: 'waiting',
      action: 'getUsers',
      resolve,
      reject
    }
    socket.sendMessage({
      ref: id,
      action: conversations[id].action
    })
  })
}

module.exports.getUsernames = () => {
  connect()

  return new Promise((resolve, reject) => {
    let id = uuid()
    conversations[id] = {
      status: 'waiting',
      action: 'getUsernames',
      resolve,
      reject
    }
    socket.sendMessage({
      ref: id,
      action: conversations[id].action
    })
  })
}
