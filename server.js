const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: '*'
  }));
  

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  })

app.use((req, res, next) => {
    req.pool = pool;
    next();
});

console.log('Connecting to PostgreSQL');

pool.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('PostgreSQL error:', err));


app.use('/uploads', express.static('uploads'));

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes)

const PORT = process.env.PORT || 3330; // Default port 3000 if PORT is not provided
const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('PostgreSQL pool has ended');
            process.exit(0); // Ensure process exits after cleanup
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('PostgreSQL pool has ended');
            process.exit(0); // Ensure process exits after cleanup
        });
    });
});

module.exports = app;
