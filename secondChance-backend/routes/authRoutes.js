const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { ObjectId } = require('mongodb')
const { body, validationResult } = require('express-validator')
const connectToDatabase = require('../models/db')
const users = async () => (await connectToDatabase()).collection('users')
const tokenFor = user => jwt.sign({ user: { id: String(user._id) } }, process.env.JWT_SECRET, { expiresIn: '1h' })
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', errors: errors.array() })
  next()
}
router.post('/register', [
  body('firstName').isString().trim().notEmpty(),
  body('lastName').isString().trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 72 })
], validate, async (req, res, next) => {
  try {
    const collection = await users()
    await collection.createIndex({ email: 1 }, { unique: true })
    const { firstName, lastName, email, password } = req.body
    if (await collection.findOne({ email })) return res.status(409).json({ error: 'Email is already registered' })
    const user = { firstName, lastName, email, password: await bcrypt.hash(password, 10) }
    const result = await collection.insertOne(user)
    user._id = result.insertedId
    res.status(201).json({ authtoken: tokenFor(user), email, userName: firstName })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Email is already registered' })
    next(error)
  }
})
router.post('/login', [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()], validate, async (req, res, next) => {
  try {
    const user = await (await users()).findOne({ email: req.body.email })
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ error: 'Invalid credentials' })
    res.json({ authtoken: tokenFor(user), userName: user.firstName, userEmail: user.email })
  } catch (error) { next(error) }
})
router.put('/update', [body('name').isString().trim().notEmpty()], validate, async (req, res, next) => {
  let userId
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '')
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    userId = new ObjectId(decoded.user.id)
  } catch (error) { return res.status(401).json({ error: 'Invalid or expired token' }) }
  try {
    if (!req.headers.email) return res.status(400).json({ error: 'Email header is required' })
    const collection = await users()
    const user = await collection.findOne({ _id: userId })
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (req.headers.email && req.headers.email !== user.email) return res.status(403).json({ error: 'Email does not match the signed-in user' })
    await collection.updateOne({ _id: userId }, { $set: { firstName: req.body.name, updatedAt: new Date() } })
    res.json({ authtoken: tokenFor(user), message: 'Profile updated', name: req.body.name, email: user.email })
  } catch (error) { next(error) }
})
module.exports = router
