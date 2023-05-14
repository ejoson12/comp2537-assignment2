const mongoose = require('mongoose');
const dotenv = require('dotenv');
const express = require('express');
const app = express();

const user = process.env.MONGODB_USER;
const password = process.env.MONGODB_PASSWORD;
dotenv.config();

main().catch(err => console.log(err));

async function main() {
  try {
    await mongoose.connect(`mongodb+srv://${user}:${password}@cluster0.lletqsu.mongodb.net/comp2537?retryWrites=true&w=majority`);

    console.log("connected to db");
    app.listen(process.env.PORT || 3000, () => {
      console.log('server is running on port 3000');
    });
  } catch (err) {
    console.error("Error connecting to db:", err.message);
  }
}