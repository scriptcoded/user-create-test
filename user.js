const linuxUser = require('linux-user')
const net = require('net')
const JsonSocket = require('json-socket')
const sh = require('shelljs')
const fs = require('fs')
const passwd = require('passwd-linux')

const socketPath = '/var/run/nodeUser.sock'

const server = net.createServer()

let retries = 0
const maxRetries = 3

let startListening = () => {
  server.listen(socketPath, () => { // 'listening' listener
    sh.chmod(777, socketPath)
  })
}

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    if (retries > maxRetries) {
      console.log(`Max retries reached (${maxRetries})`)
      return
    }
    if (retries >= 1) {
      console.log(`Retry #${retries}`)
    }
    retries++

    let clientSocket = new net.Socket()

    clientSocket.on('error', e => {
      if (e.code === 'ECONNREFUSED') {
        fs.unlinkSync(socketPath)
        console.log('Server recovered')
        startListening()
      }
    })
    clientSocket.connect(socketPath, () => {
      console.log('Server already running, giving up...')
      process.exit()
    })
  }
})

startListening()

server.on('listening', () => {
  console.log(`Server listening on "${socketPath}"`)
})

server.on('connection', socket => {
  socket = new JsonSocket(socket)

  socket.on('message', message => {
    switch (message.action) {
      case 'create':
        linuxUser.addUser(message.username, (err, user) => {
          if (err) {
            switch (err.code) {
              case 9:
                return socket.sendEndMessage({
                  ref: message.ref,
                  status: 'error',
                  code: 'userExists',
                  message: 'Username already in use'
                })
              default:
                return socket.sendEndMessage({
                  ref: message.ref,
                  status: 'error',
                  code: 'unknownError',
                  message: 'Unknown error'
                })
            }
          }

          passwd.changePassword(message.username, message.password, (err, response) => {
            if (err || !response) {
              switch ((err || {}).code) {
                default:
                  return socket.sendEndMessage({
                    ref: message.ref,
                    status: 'error',
                    code: 'unknownError',
                    message: 'Unknown error'
                  })
              }
            }

            socket.sendEndMessage({
              ref: message.ref,
              status: 'success',
              responseTo: 'create',
              createdUser: message.username
            })
          })
        })
        break
      case 'check':
        linuxUser.getUserInfo(message.username, (err, user) => {
          if (err) {
            return socket.sendEndMessage({
              ref: message.ref,
              status: 'error',
              code: 'unknownError',
              message: 'Unknown error'
            })
          }

          socket.sendEndMessage({
            ref: message.ref,
            status: 'success',
            responseTo: 'check',
            userExists: !!user
          })
        })
        break
      case 'getUsers':
        linuxUser.getUsers((err, users) => {
          if (err) {
            return socket.sendEndMessage({
              ref: message.ref,
              status: 'error',
              code: 'unknownError',
              message: 'Unknown error'
            })
          }

          socket.sendEndMessage({
            ref: message.ref,
            status: 'success',
            responseTo: 'getUsers',
            users: users
          })
        })
        break
      case 'getUsernames':
        linuxUser.getUsers((err, users) => {
          if (err) {
            return socket.sendEndMessage({
              ref: message.ref,
              status: 'error',
              code: 'unknownError',
              message: 'Unknown error'
            })
          }

          socket.sendEndMessage({
            ref: message.ref,
            status: 'success',
            responseTo: 'getUsers',
            usernames: users.map(user => user.username)
          })
        })
        break
      default:
        socket.sendEndMessage({
          ref: message.ref,
          status: 'error',
          code: 'invalidAction',
          message: 'Invalid action'
        })
        break
    }
  })
})
