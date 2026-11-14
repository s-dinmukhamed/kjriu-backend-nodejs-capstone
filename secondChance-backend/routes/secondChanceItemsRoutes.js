const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { randomUUID } = require('crypto')
const router = express.Router()
const connectToDatabase = require('../models/db')
const directoryPath = path.join(__dirname, '../public/images')
fs.mkdirSync(directoryPath, { recursive: true })
const storage = multer.diskStorage({
  destination: directoryPath,
  filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname).toLowerCase())
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })
const collection = async () => (await connectToDatabase()).collection('secondChanceItems')
function fields (body) {
  const result = {}
  for (const key of ['name', 'category', 'condition', 'zipcode', 'description', 'posted_by']) {
    if (typeof body[key] === 'string') result[key] = body[key].trim()
  }
  for (const key of ['age_days', 'age_years']) {
    if (body[key] !== undefined) result[key] = Number(body[key])
  }
  return result
}
router.get('/', async (req, res, next) => {
  try { res.json(await (await collection()).find({}).toArray()) } catch (error) { next(error) }
})
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const item = fields(req.body)
    if (!item.name) return res.status(400).json({ error: 'Name is required' })
    item.id = randomUUID()
    item.date_added = Math.floor(Date.now() / 1000)
    item.comments = []
    item.image = req.file ? '/images/' + req.file.filename : ''
    const inserted = await (await collection()).insertOne(item)
    res.status(201).json({ ...item, _id: inserted.insertedId })
  } catch (error) { next(error) }
})
router.get('/:id', async (req, res, next) => {
  try {
    const item = await (await collection()).findOne({ id: req.params.id })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json(item)
  } catch (error) { next(error) }
})
router.put('/:id', async (req, res, next) => {
  try {
    const result = await (await collection()).updateOne({ id: req.params.id }, { $set: fields(req.body) })
    if (!result.matchedCount) return res.status(404).json({ error: 'Item not found' })
    res.json(await (await collection()).findOne({ id: req.params.id }))
  } catch (error) { next(error) }
})
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await (await collection()).deleteOne({ id: req.params.id })
    if (!result.deletedCount) return res.status(404).json({ error: 'Item not found' })
    res.json({ message: 'Item deleted' })
  } catch (error) { next(error) }
})
module.exports = router
