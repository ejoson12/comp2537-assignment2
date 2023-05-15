// Load the necessary modules
const express = require('express');
const session = require('express-session');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Load the MongoDB driver and connect to the database
var MongoDBStore = require('connect-mongodb-session')(session);

const port = process.env.PORT || 3000;

// Create an Express app
const app = express();

const dotenv = require('dotenv');
dotenv.config();

// Set the view engine
app.set('view engine', 'ejs');

// Connect to the users database
mongoose.connect(`mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.lletqsu.mongodb.net/users?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
const userDbConnection = mongoose.connection;

// Connect to the database
var dbStore = new MongoDBStore({
    uri: `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.lletqsu.mongodb.net/comp2537?retryWrites=true&w=majority`,
    collection: 'sessions',
    touchAfter: 3600 // time period in seconds
});

const User = require('./models/user.js');

// Set up session middleware
app.use(session({
    secret: `${process.env.NODE_SESSION_SECRET}`,
    store: dbStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600000, // milliseconds
    }
}));

app.use(express.static('public'));

// Set up middleware to store the user's name in the session
app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.username = req.session.user.name;
    }
    next();
});

// Home page
app.get('/', (req, res) => {
  if (req.session.user) {
    res.render('index', { username: req.session.user.name, isLoggedIn: true });
  } else {
    res.render('index', { isLoggedIn: false });
  }
});

// Sign up page
app.get('/signup', (req, res) => {
  res.render('signup');
});

const signUpSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.post('/signup', async (req, res) => {
  try {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;
    
    const { error } = signUpSchema.validate({ name, email, password });
    if (error) {
      throw new Error(error.details[0].message);
    }

    User.db = userDbConnection;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name: name,
      email: email,
      password: hashedPassword,
    });
    
    await user.save();
    req.session.user = { name: user.name , email: user.email, password: user.password, userType: user.userType};
    res.redirect('/members');
    
  } catch (error) {
    console.log(error);
    res.send(`Error signing up: ${error.message}. <a href="/signup">Try again</a>`);
  }
});

// Log in page
app.get('/login', (req, res) => {
  res.render('login');
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

app.post('/login', async (req, res) => {
  var email = req.body.email;
  var password = req.body.password;

  const { error } = loginSchema.validate({ email, password });
  if (error) {
    throw new Error(error.details[0].message);
  }

  if (!email || !password) {
    res.send('Please provide all fields. <a href="/login">Try again</a>');
  } else {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        res.send('Email or password is incorrect. <a href="/login">Try again</a>');
      } else {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          req.session.user = { id: user._id, name: user.name, email: user.email, userType: user.userType };
          res.redirect('/members');
        } else {
          res.send('Email or password is incorrect. <a href="/login">Try again</a>');
        }
      }
    } catch (err) {
      res.send('An error occurred. <a href="/login">Try again</a>');
    }
  }
});

// Members page
app.get('/members', (req, res) => {
  res.render('members', { user: req.session.user });
});

// Admin page
app.get('/admin', async function(req, res) {
  User.db = userDbConnection;

  try {
    // Check if the user is an admin
    if (!req.session.user || req.session.user.userType !== 'admin') {
      return res.status(403).send('Unauthorized');
    }
    
    const users = await User.db.collection('users').find().toArray();
    res.render('admin', { users });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post('/admin/promote', async (req, res) => {
  User.db = userDbConnection;
  var name = req.body.name;

  try {
    const user = await User.findOne({ name });
    if (!user) throw new Error('User not found');
    user.userType = 'admin';
    await user.save();
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/admin/demote', async (req, res) => {
  User.db = userDbConnection;
  var name = req.body.name;

  try {
    const user = await User.findOne({ name });
    if (!user) throw new Error('User not found');
    user.userType = 'user';
    await user.save();
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

//Logout page
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
});


// 404 page
app.get('*', (req, res) => {
    res.status(404).render('404');
});

main().catch(err => console.log(err));

async function main() {
  app.listen(process.env.PORT || 3000, () => {
    console.log('server is running on port 3000');
  });
}
