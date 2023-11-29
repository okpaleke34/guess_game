// integration.test.js
const request = require('supertest');
const { app } = require('../app'); // Adjust the path based on your project structure
const { expect } = require('chai');
const { genID } = require('../app/helpers/functions');

describe('Integration Tests for gameRoutes', () => {
    beforeEach(() => {
        // Initialize a new instance of the Oracle class before each test
        // oracleInstance = new Oracle(null, null);
        // Start the server before each test
    });
    describe('Player Registration', () => {
        var playerData = {fname:"test_fname",lname:"test_lname",email:"test_email",password:"test123",cpassword:"test123",remember:true}
        var randomText = genID(10,"alpha");
        it('should require complete form', (done) => {
            request(app)
            .post('/register')
            .send(playerData)
            .expect(400)
            .expect('Content-Type', /json/)
            .end((err, res) => {
                if (err) return done(err);

                // Assertions based on response body
                expect(res.body).to.have.property('message').that.includes('Invalid form data');

                done();
            });
        });
        it('should require a valid email format', (done) => {            
            playerData.username = `test_username_${randomText}`;
            request(app)
            .post('/register')
            .send(playerData)
            .expect(400)
            .expect('Content-Type', /json/)
            .end((err, res) => {
                if (err) return done(err);

                // Assertions based on response body
                expect(res.body).to.have.property('errors').that.includes.members(['Invalid email format']);

                done();
            });
        });
        it('should register a new player', (done) => {
            console.log({playerData})
            playerData.email = `test_email_${randomText}@email.com`;
            request(app)
            .post('/register')
            .send(playerData)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
                if (err) return done(err);

                // Assertions based on response body
                expect(res.body).to.have.property('message').that.includes('Player registered successfully');
                expect(res.body).to.have.property('token');

                done();
            });
        });

        it('should login a player', (done) => {
            var player = {player:playerData.username,password:playerData.password}
            request(app)
            .post('/login')
            .send(player)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
                if (err) return done(err);
    
                // Add assertions based on your application's behavior
                expect(res.body).to.have.property('message').that.includes('Player logged in successfully');
                expect(res.body).to.have.property('token');
    
                done();
            });
        });
    });
    // it('should login a player', (done) => {
    //     const userData = {
    //         user: 'johndoe',
    //         password: 'pass123',
    //     };

    //     request(app)
    //     .post('/login')
    //     .send(userData)
    //     .expect(200)
    //     .expect('Content-Type', /json/)
    //     .end((err, res) => {
    //         if (err) return done(err);

    //         // Add assertions based on your application's behavior
    //         expect(res.body).to.have.property('message').that.includes('Player logged in successfully');
    //         expect(res.body).to.have.property('token');

    //         done();
    //     });
    // });

  // Add more test cases for other routes as needed
});
