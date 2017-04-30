const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const expressSession = require('express-session');
const bcrypt = require('bcrypt-nodejs');

const MONGO_ADDR = process.env.MONGO_PORT_27017_TCP_ADDR || '192.168.1.40';
const MONGO_PORT = process.env.MONGO_PORT_27017_TCP_PORT || 27017;
const HTTP_PORT = process.env.PORT || 9090;

// Express configuration
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/**
 * Mongo configuration
 *  docker run -p 27017:27017 --name test-mongo -d mongo
 *  docker run -p 27017:27017 --name test-mongo -d dhermanns/rpi-mongo
 */
mongoose.connect(`mongodb://${MONGO_ADDR}:${MONGO_PORT}/test-mongo`);
mongoose.Promise = global.Promise;
const User = mongoose.model('User', {
    username: String,
    password: String
});

// Passport configuration
app.use(expressSession({ secret: 'mySecretKey', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser((id, done) => User.findById(id, (err, user) => done(err, user)));
passport.use('login', new localStrategy({ passReqToCallback: true },
    (req, username, password, done) => {
        User.findOne({ 'username': username },
            (err, user) => {
                if (err)
                    return done(err);
                if (!user)
                    return done(null, false);
                if (!bcrypt.compareSync(password, user.password))
                    return done(null, false);
                return done(null, user);
            }
        );
    }));

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated())
        return next();
    res.redirect('/login.html');
}

// Dirty user creation /!\
User.findOne({ "username": "user" })
    .then(data =>
        data || new User({ username: "user", password: bcrypt.hashSync("pwd") })
            .save()
            .then(console.log)
    );

// Serve static file
app.use('/', express.static(path.join(__dirname, 'public')));

// Login & logout
app.post('/login', passport.authenticate('login', {
    successRedirect: '/',
    failureRedirect: '/login.html'
}));
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/login.html');
});

// Default 
app.get('/', isAuthenticated, (req, res) => res.json({ message: 'Hello ' + req.user.username + "!" }));
app.get('/test', isAuthenticated, (req, res) => res.json({ message: 'Test!' }));

// Error
app.use((err, req, res, next) => {
    console.log(err.stack);
    res.status(500).json({ 'error': err });
});

// & Start!
app.listen(HTTP_PORT);
console.log('Listening on ' + HTTP_PORT);