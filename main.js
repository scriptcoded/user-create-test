const userInterface = require('./userInterface')

;(async () => {
  console.log(await userInterface.createUserIncrement('test', '123'))
})()
