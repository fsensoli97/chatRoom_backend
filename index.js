const express = require('express');
const path = require('path');
const http = require('http');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors')
const joi = require('joi');
const { userValidation } = require('./userValidation');

const app = express();
const port = process.env.PORT || 2000;
app.use(express.static(path.join(__dirname, 'static'), { index : false })); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors({ origin: true, credentials: true }));

let server = http.createServer(app);

const database = "chat_room";
let isConnected = false;
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Datalogic4",
    database: database
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

    db.query(`SELECT users.id, users.username, users.password FROM users WHERE users.username = "${req.body.username}" LIMIT 1;`, (err, result) => {
        if (err) throw err;

        if(!result.length) {
            console.log(`[INFO] ${req.body.username} does not exist`);
            return res.json({ 
                success: false,
                message: `${req.body.username} does not exist.` 
            });
        }

        if (req.body.password != result[0].password) {
            return res.json({ 
                success: false,
                message: `Password incorrect.` 
            });
        }
        
        db.query(`UPDATE users SET isOnline = true WHERE id = ${result[0].id}`, (err) => {
            if (err) throw err;
            return res.json({ success: true, id: result[0].id, username: req.body.username });
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

    db.query(`SELECT users.username FROM users WHERE users.username = "${req.body.username}" LIMIT 1;`, (err, result) => {
        if (err) throw err;
        if(result.length) {
            console.log('result: ' + result);
            console.log(`[INFO] ${req.body.username} already exists.`);
            return res.json({ success: false });
        }
        else {
            db.query(`INSERT INTO users(username, password) VALUES ("${req.body.username}", "${req.body.password}");`, (err, result) => {
                if (err) throw err;
                console.log(`[INFO] inserted ${req.body.username} user.`);
                return res.json({ success: true});
            });
        }
    });
});

app.get('/messages', (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }
    
    db.query("SELECT * FROM messages ORDER BY id DESC LIMIT 10;", (err, result) => {
        if (err) throw err;
        return res.json(result);
    })
});

app.post('/messages', (req, res) => {
    if (!isConnected) {
        return res.status(500).send("Cannot connect to db.");
    }

    db.query(`INSERT INTO messages(user, text, date) VALUES ("${req.body.user}", "${req.body.text}", current_timestamp());`, (err, result) => {
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
    
    db.query(`UPDATE messages SET text = "${req.body.text}" WHERE id = ${req.query.id};`, (err, result) => {
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

server.listen(port, () => {
    console.log(`[INFO] Webserver listening on port ${port}.`);
});