const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');

dotenv.config();

const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

console.log('Connecting to PostgreSQL');

pool.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('PostgreSQL error:', err));

app.use((req, res, next) => {
    req.pool = pool;
    next();
});

app.use('/api/users', userRoutes);

app.use('/', (req, res) => {
    res.json({ message: 'Hello, world!' });
});

const PORT = process.env.PORT || 3330; // Provide a default port
const server = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('PostgreSQL pool has ended');
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('PostgreSQL pool has ended');
        });
    });
});

module.exports = server;
