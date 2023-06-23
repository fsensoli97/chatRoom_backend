const express = require('express');
const path = require('path');
const http = require('http');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors')
const joi = require('joi');
const { userValidation } = require('./userValidation');
const nodemailer = require("nodemailer");
const multer = require('multer');
const upload = multer({ dest: 'profilePics/' });
const pg = require('pg');

const serverUrl = "https://chat-room-6vz9.onrender.com/";
const app = express();
const port = process.env.PORT || 2000;
app.use(express.static(path.join(__dirname, 'static'), { index : false })); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
//app.use(cors({ origin: true, credentials: true }));
//app.use(cors());

let server = http.createServer(app);

/*
const database = "chat_room";
let isConnected = false;
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Datalogic4",
    database: database
});
*/

/*
const database = 'chatroom';
let isConnected = false;
const db = new pg.Client({
    host: 'localhost',
    database: database,
    port: 5432,
    user: 'postgres',
    password: 'Datalogic5',
});
*/

const database = 'chatroomdb';
let isConnected = false;
const db = new pg.Client({
    host: 'dpg-cialr0l9aq007t9r9uh0-a',
    database: database,
    port: 5432,
    user: 'fsensoli',
    password: 'KjjJ6FXXcvh6EJj1FEwNBD9W5qCiy9Op',
});

db.connect((err) => {
    if (err) throw err;
    console.log(`[INFO] Connected to ${database} database.`);
    isConnected = true;
})

app.post('/login', (req, res) => {
    if (!isConnected) {
        return res.status(500).send("[ERROR] Cannot connect to db.");
    }

    db.query(`SELECT id, username, password, isVerified FROM users WHERE username = '${req.body.username}' OR email = '${req.body.username}' LIMIT 1;`, (err, result) => {
        if (err) throw err;

        if(!result.rows[0]) {
            console.log(`[INFO] ${req.body.username} does not exist`);
            return res.json({ 
                success: false,
                message: `${req.body.username} does not exist.` 
            });
        }

        if (!result.rows[0].isverified) {
            return res.json({ 
                success: false,
                message: `Please verify your email.` 
            }); 
        }

        if (req.body.password != result.rows[0].password) {
            return res.json({ 
                success: false,
                message: `Password incorrect.` 
            });
        }
        
        db.query(`UPDATE users SET isOnline = true WHERE id = ${result.rows[0].id}`, (err) => {
            if (err) throw err;
            return res.json({ success: true, id: result.rows[0].id, username: result.rows[0].username });
        })
        
    });
});

app.post('/signin', (req, res) => {
    if (!isConnected) {
        return res.status(500).send("[ERROR] Cannot connect to db.");
    }

    const validation = userValidation(req.body);
    if (validation.error) {
        console.log("[INFO]" + validation.error.details.message);
        return res.json({ success: false, message: validation.error });
    }

    db.query(`SELECT username FROM users WHERE username = '${req.body.username}' OR email = '${req.body.email}' LIMIT 1;`, (err, result) => {
        if (err) throw err;
        if(result.length) {
            console.log('result: ' + result);
            console.log(`[INFO] ${req.body.username} or ${req.body.email} already exists.`);
            return res.json({ success: false });
        }
        else {
            db.query(`INSERT INTO users(username, email, password) VALUES ('${req.body.username}', '${req.body.email}', '${req.body.password}');`, (err, result) => {
                if (err) throw err;
                console.log(`[INFO] inserted ${req.body.username} user.`);

                let randomString = "";
                for (let i = 0; i < 12; i++) {
                    randomString += (Math.floor(Math.random() * 10)).toString();
                }

                db.query(`UPDATE users SET verificationCode = '${randomString}' WHERE username = '${req.body.username}';`, (err, result) => {
                    if (err) throw err;
                });

                sendMail(req.body.email, randomString, req.body.username);

                return res.json({ success: true});
            });
        }
    });
});

app.get('/verify', (req, res) => {
    db.query(`SELECT id FROM users WHERE verificationCode = '${req.query.code}'`, (err, result) => {
        if (err) throw err;

        db.query(`UPDATE users SET isVerified = true WHERE id = ${result.rows[0].id}`, (err) => {
            if (err) throw err;
            console.log(`[INFO] Verified user ${result.rows[0].id}`);
            return res.send('Successfully verified email.');
        })
    })
})

app.get('/messages', (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }
    
    db.query(`SELECT * FROM messages ORDER BY id DESC LIMIT ${req.query.num};`, (err, result) => {
        if (err) throw err;
        return res.json(result.rows);
    })
});

app.post('/messages', (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }

    db.query(`INSERT INTO messages(username, text) VALUES ('${req.body.user}', '${req.body.text}');`, (err, result) => {
        if (err) throw err;
        console.log(`[INFO] inserted ${req.body.text} message.`);
        return res.sendStatus(200);
    })
});

app.put("/logout", (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }
    
    db.query(`UPDATE users SET isOnline = false WHERE id = ${req.query.id};`, (err, result) => {
        if (err) throw err;
        return res.json(result);
    });
}); 

app.put("/editMessage", (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }
    
    db.query(`UPDATE messages SET text = '${req.body.text}' WHERE id = ${req.query.id};`, (err, result) => {
        if (err) throw err;
        return res.json(result);
    });
});

app.delete("/deleteMessage", (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }
    
    db.query(`DELETE FROM messages WHERE id = ${req.query.id};`, (err, result) => {
        if (err) throw err;
        return res.json(result);
    });
});

app.get("/users", (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }

    db.query(`SELECT id, username, isOnline, isVerified FROM users`, (err, result) => {
        if (err) throw err;
        return res.json(result.rows);
    })
});

app.put('/profilepic', upload.single('profilePic'), (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }

    db.query(`UPDATE users SET profilePicturePath = '${req.file.filename}' WHERE id = ${req.query.id};`, (err, result) => {
        if (err) throw err;
        return res.json(result.rows);
    });
})

app.get('/profilepic', (req, res) => {    
    db.query(`SELECT profilePicturePath FROM users WHERE id = ${req.query.id};`, (err, result) => {
        if (err) throw err;
        if (!result.rows[0].profilepicturepath) {
            return res.json(null);
        }
        return res.sendFile(path.join(__dirname, "profilePics", result.rows[0].profilepicturepath));
    });
})

server.listen(port, () => {
    console.log(`[INFO] Webserver listening on port ${port}.`);
});


const sendMail = (destinationMail, randomString, user) => {
    const Transport = nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: "chatroomapp123@gmail.com",
            pass: "zjvdquujvbldctkp"
        }
    });

    const mailOptions = {
        from: "chatroomapp123@gmail.com",
        to: destinationMail,
        subject: "Confirm registration",
        html: `Hi ${user},<br>please click <a href="${serverUrl}verify?code=${randomString}">here</a> to verify your mail.`
    };

    Transport.sendMail(mailOptions, (err) => {
        if (err) throw err;
        console.log(`[INFO] Verification mail sent to ${destinationMail}`);
    });
}