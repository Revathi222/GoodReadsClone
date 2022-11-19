const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
app.use(express.json());

let dbPath = path.join(__dirname, "goodreads.db");

let db = null;
const connectDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at 3000 port");
    });
  } catch (e) {
    console.log("${e.message}");
    process.exit(1);
  }
};

connectDbAndServer();
// Register User
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const getUserQuery = `select * from user where name='${name}';`;
  const dbUser = await db.get(getUserQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    const addUserQuery = `INSERT INTO user (username,name,password,gender,location)
        VALUES('${username}','${name}','${hashedPassword}','${gender}','${location}');`;
    const dbUser = await db.run(addUserQuery);
    const userId = dbUser.lastID;
    response.send(`${userId}`);
  } else {
    response.status = 400;
    response.send("user already registered");
  }
});

// login user with authentication
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetails = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(getUserDetails);
  if (dbUser === undefined) {
    response.status = 400;
    response.send("Invalid user");
  } else {
    const machedPassword = await bcrypt.compare(password, dbUser.password);
    if (machedPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status = 400;
      response.send("Invalid user");
    }
  }
});

//Middleware authentication
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid access Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.send("Invalid access token");
  }
};

//get User profile with token authentication
app.get("/profile/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userDetails = `SELECT * FROM user WHERE username='${username}';`;
  const userProfile = await db.get(userDetails);
  response.send(userProfile);
});

//GET books with access token
app.get("/books/", authenticateToken, async (request, response) => {
  const bookQuery = `SELECT * FROM book;`;
  const booksArray = await db.all(bookQuery);
  response.send(booksArray);
});

// GET book
app.get("/books/:bookId", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const getBook = `select * from book where id=${bookId};`;
  const book = await db.get(getBook);
  response.send(book);
});

// add book API
app.post("/books/", authenticateToken, async (request, response) => {
  const bookdetails = request.body;
  const { id, name } = bookdetails;
  const addBookQuery = `INSERT INTO book (id,name)
    VALUES (${id},'${name}');`;
  const dbResponse = await db.run(addBookQuery);
  const bookId = dbResponse.lastID;
  response.send({ bookId: bookId });
});

//update a book
app.put("/books/:bookId", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const bookdetails = request.body;
  const { name } = bookdetails;
  const updateBookQuery = `UPDATE book 
    SET name='${name}'
    where id=${bookId};`;
  const dbResponse = await db.run(updateBookQuery);
  response.send("Row Updated successfully");
});

// Delete API
app.delete("/books/:bookId/", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const deleteBookQuery = `
    DELETE FROM
      book
    WHERE
      id = ${bookId};`;
  await db.run(deleteBookQuery);
  response.send("Book Deleted Successfully");
});

//Get book list based on search with query parameters
app.get("/books/", authenticateToken, async (request, response) => {
  const {
    offset = 2,
    limit = 5,
    order = "ASC",
    order_by = "book_id",
    search_q = "",
  } = request.query;
  const getBooksQuery = `
    SELECT
      *
    FROM
     book
    WHERE
     title LIKE '%${search_q}%'
    ORDER BY ${order_by} ${order}
    LIMIT ${limit} OFFSET ${offset};`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});
