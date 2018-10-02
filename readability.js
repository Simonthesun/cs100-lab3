const fs = require("fs");
const md5File = require('md5-file');
const sqlite3 = require('sqlite3');
const Tokenizer = require('tokenize-text');
const tokenize = new Tokenizer();
const tokenizeEnglish = require("tokenize-english")(tokenize);

// Parses a text file into words, sentences, characters
function readability(filename, callback) {
    fs.readFile(filename, "utf8", (err, contents) => {
        if (err) throw err;

        let db = new sqlite3.Database('texts.db', (err) => { // load sqlite database
            if (err) {
                console.error(err.message);
            }

            // console.log('Connected to the database.');

            md5File(filename, (err, hash) => { // create hash
                if (err) {
                    throw err;
                }

                let sql = `SELECT * FROM texts WHERE hash = ?`; // retrieve rows with hash

                db.get(sql, [hash], (err, row) => {
                    if (err) {
                        return console.error(err.message);
                    }

                    return row
                    ? callback(row.characters, row.words, row.sentences, row.CL, row.ARI) // print if exists in db
                    : insert(contents, filename, callback, db, hash); // else insert it
                });
            })

            

            
        });

        

        
    });
};

function insert(contents, filename, callback, db, hash) { // calculate values and insert them into sqlite table
    
    // count tokens

    let letters = tokenize.re(/[A-Za-z]/)(contents).length;
    let numbers = tokenize.re(/[0-9]/)(contents).length;

    let words = tokenize.words()(contents).length;

    let sentences = tokenizeEnglish.sentences()(contents.split(/\n/).join(' ')).length;

    // calculate values

    let cl = colemanLiau(letters, words, sentences);
    let ari = automatedReadabilityIndex(letters, numbers, words, sentences);

    callback(letters + numbers, words, sentences, cl, ari); // print

    let insert = `INSERT INTO texts (name, characters, words, sentences, CL, ARI, hash) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(insert, [filename, letters + numbers, words, sentences, cl, ari, hash], (err) => {
        if (err) {
            return console.error(err.message);
        }

        // console.log("Row inserted.")
    });
}

// Computes Coleman-Liau readability index
function colemanLiau(letters, words, sentences) {
    return (0.0588 * (letters * 100 / words))
        - (0.296 * (sentences * 100 / words))
        - 15.8;
}

// Computes Automated Readability Index
function automatedReadabilityIndex(letters, numbers, words, sentences) {
    return (4.71 * ((letters + numbers) / words))
        + (0.5 * (words / sentences))
        - 21.43;
}

// Calls the readability function on the provided file and defines callback behavior
if (process.argv.length >= 3) {
    readability(process.argv[2], (c, w, s, cl, ari) => {
        console.log("REPORT for " + process.argv[2]);
        console.log(c + " characters");
        console.log(w + " words");
        console.log(s + " sentences");
        console.log("------------------");
        console.log("Coleman-Liau Score: " + cl.toFixed(3));
        console.log("Automated Readability Index: " + ari.toFixed(3));
    });
}
else {
    console.log("Usage: node readability.js <file>");
}
