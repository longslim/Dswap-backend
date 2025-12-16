const express = require("express")
const mongoose = require("mongoose")
const cookieParser = require("cookie-parser")
const methodOverride = require("method-override")
const cors = require("cors")
const bodyParser = require("body-parser")
const { connectDB } = require("./database/database")
const { userRouter } = require("./routes/userRoutes")
const { transactionRouter } = require("./routes/transactionRoutes")
const { depositRouter } = require("./routes/depositRoutes")
const { btcRouter } = require("./routes/btcRoutes")
const { loanRouter } = require("./routes/loanRoutes")
const { utilityRouter } = require("./routes/utilityRoutes")
const fs = require("fs");
const path = require("path")

require("dotenv").config()





const app = express()
const port = process.env.PORT || 8080
const corsOptions = {
    origin: ["http://localhost:5173"],
    credentials: true
}


const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}


app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(cookieParser())
app.use(methodOverride("_method"))
app.use(bodyParser.json())
app.use("/uploads", express.static("uploads"))
app.use("/api/v1/plaid-webhook", express.json({ type: "application/json" }));

app.use("/api/v1", userRouter, transactionRouter, depositRouter, btcRouter, loanRouter, utilityRouter)




app.get("/", (req, res) => {
    res.send("✅ API is running")
})




const { signupModel } = require("./models/signupModel");







// signupModel.collection.dropIndex("frontId_1").catch(err => console.log("frontId index not found"));
// signupModel.collection.dropIndex("backId_1").catch(err => console.log("backId index not found"));
// signupModel.collection.dropIndex("cvvNumber_1")




async function server() {
    await connectDB()
    require("./jobs/cronJob")
    app.listen(port, () => console.log(`server is running on port: ${port}`))
    
}

server()