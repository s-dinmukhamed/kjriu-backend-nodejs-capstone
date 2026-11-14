require('dotenv').config()
const { MongoClient } = require('mongodb')
let client, connection
async function connectToDatabase () {
  if (!connection) {
    client = new MongoClient(process.env.MONGO_URL)
    connection = (async () => {
      await client.connect()
      return client.db(process.env.MONGO_DB || 'secondChance')
    })().catch(error => { connection = null; throw error })
  }
  return connection
}
connectToDatabase.close = async () => { if (client) await client.close(); connection = null }
module.exports = connectToDatabase
