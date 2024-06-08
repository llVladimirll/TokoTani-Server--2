const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const register = async (req, res, pool) => {
    const { name, email, password } = req.body;
    try{
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',[name, email, hashedPassword]
        );
        res.status(201).json({message: 'User Registered Successfully'});
      }catch(err){
        console.log(err);
        res.status(500).json({ message: 'Error registering user' });
      }
}

const login = async (req, res, pool) => {
  const {email, password} = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    if (result.rows.length === 0){
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if(!isPasswordValid){
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({userID : user.id }, process.env.JWT_SECRET, { expiresIn: '12h'});
    res.status(200).json({ token: token});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error in logging user' });
  }
}

module.exports = {
    register,
    login
}