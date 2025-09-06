const express = require('express')

const app  = express()

app.get('/', (req, res) => {
    res.send('hello, shivam')
})

app.get('/shivam', (req, res) => {
    res.send('hello, hitemw oi')
})

app.listen(3000, () => {
    console.log('Server is listening on port 3000')
})