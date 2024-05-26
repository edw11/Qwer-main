import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import  bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
var tempTime;
var room;

let timeList = {
    time1:9,
    time2:10,
    time3:11,
    time4:12,
    time5:13,
    time6:14,
    time7:15,
    time8:16,
    time9:17,
    time10:18,
    time11:19,
    time12:20
}

app.use(
    session({
        secret: "TOPSECRET",
        resave: false,
        saveUninitialized: true
    })
)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "qwer",
    password: "password",
    port: 5432,
});

db.connect();

app.get("/", (req, res) => {
    res.render("login.ejs");
});

app.get("/booked", (req, res) => {
    res.render("booked.ejs");
});

app.post("/cancel", async (req,res)=>{
if(req.isAuthenticated){
    let user = req.user
    console.log(user.id)
    try{
        const result = await db.query("SELECT * FROM q_user where id=$1", [user.id]);
        const timeBooking = result.rows[0].timebook
        const userHistory = await db.query("SELECT * FROM q_user JOIN history ON q_user.id = history.user_id WHERE status != 'Complete' AND user_id = $1", [user.id]);
        const seat_number = userHistory.rows[0].seat_number
        console.log(seat_number)
        await db.query("UPDATE history SET status = 'Complete' WHERE status != 'Complete' AND user_id = $1", [user.id]);
        await db.query("UPDATE q_user SET is_booked = $1 WHERE id = $2", [0, user.id]);
        await db.query(`UPDATE seat SET ${timeBooking} = $1 WHERE seat_number= $2`, [0, seat_number]);
        res.redirect("/home")
    }catch(err){
        console.log(err)
    }
}else{
    res.redirect("/")
}
})

app.post("/confirm", async (req, res) => {
    let status = 1;
    let userStatus = "Active";
    const result = req.body;
    const user = req.user.id;
    var optionHour
    // Get the current time
    // const startTime = new Date();

    Object.entries(timeList).forEach(([key, value]) => {
        if(key === tempTime){
             optionHour = value;
        }
    });

    // Calculate the end time (+60 minutes from the start time) and round it up to the next hour
    // const endTime = new Date(startTime);
    // endTime.setHours(endTime.getHours() + 1);
    // endTime.setMinutes(0);
    // endTime.setSeconds(0);

    // // Calculate the end time (+60 minutes from the start time) and round it up to the next 5 minutes
    // const endTime = new Date(startTime);
    // endTime.setMinutes(endTime.getMinutes() + 5 - (endTime.getMinutes() % 5)); // Round up to the next 5 minutes
    // endTime.setSeconds(0);

    // Extract hours and minutes for start time
    const startHours = optionHour
    const startMinutes = 0;

    // Extract hours and minutes for end time
    const endHours = optionHour + 1
    const endMinutes = 0

    const startTimeFinal = startHours + ":" + (startMinutes < 10 ? "0" : "") + startMinutes;
    const endTimeFinal = endHours + ":" + (endMinutes < 10 ? "0" : "") + endMinutes;

    try {
        // Assuming tempTime is defined somewhere, otherwise replace it with the correct value
        const seat = await db.query(`UPDATE seat SET ${tempTime} = $1 WHERE seat_number = $2`, [status, req.body.seatNumber]);
        const history = await db.query("INSERT INTO history (room, seat_number, start_time, end_time, status, user_id) VALUES ($1, $2, $3, $4, $5, $6)", [room, req.body.seatNumber, startTimeFinal, endTimeFinal, userStatus, user]);
        const timeBooked = await db.query(`UPDATE q_user SET timebook = $1 WHERE id = $2`, [tempTime, user]);
        const isBooked = await db.query(`UPDATE q_user SET is_booked = $1 WHERE id=$2`, [status, user]) //for checking user reservation
        // Start the async function to update status to "Complete"
        updateStatusToComplete();

        res.redirect("/home");
    } catch (err) {
        console.log(err);
        res.status(500).send("Error occurred");
    }
});



app.post("/next", async (req,res)=>{
    let status = 1
    const next = req.body
    const user = req.user.is_booked
    let seats = []
    tempTime = next.selectedTime
    console.log(tempTime)
    console.log(typeof(tempTime))
    room = next.selectedRoom
    try{
        if(user === 1){
            res.redirect("/")
        }else{
            const result = await db.query(`SELECT seat_number FROM seat WHERE ${next.selectedTime} = $1`,[status])
            result.rows.forEach((seat) =>{
                seats.push(seat.seat_number)
            })
            res.render("booking.ejs",{seats:seats})
        }
    }catch(err){
        console.log(err)
    }
})

app.get("/register",(req,res)=>{
    res.render("register.ejs")
});

app.get("/login", (req,res)=>{
    res.render("login.ejs")
})

app.get("/history", async (req,res)=>{
    const user = req.user
    try{
        console.log("ok")
        const result = await db.query("SELECT * FROM q_user JOIN history ON q_user.id = history.user_id WHERE q_user.id = $1", [user.id]);
        res.render("history.ejs",{data: result.rows})
        console.log(result.rows)
    }catch(err){
        console.log(err)
    }
})

app.get("/profile", async (req, res)=>{
    const id = req.user.id;
    try{
        const result = await db.query("SELECT * FROM q_user WHERE id = $1",[id])
        if(result.rows.length > 0){
            const user = result.rows[0]
            const email = user.email
            const studentNumber = user.studentnumber
            const major = user.major
            res.render("profile.ejs",{email:email, studentNumber:studentNumber, major:major})
        }else{
            res.render("profile.ejs")
        }
    }catch(err){
        console.log(err)
    }
})



app.get("/home", async (req, res) => {
    if (req.isAuthenticated()) {
        let user = req.user.id
        console.log(user)
        try{
            const result = await db.query("SELECT is_booked FROM q_user WHERE id = $1", [user]);
            
            const resultBooked = await db.query("SELECT * FROM q_user JOIN history ON q_user.id = history.user_id WHERE status != 'Complete' AND user_id = $1", [user]);
            const isBooked = result.rows[0].is_booked
            if(isBooked === 1){
                const room = resultBooked.rows[0].room
                const seat = resultBooked.rows[0].seat_number
                const start_time = resultBooked.rows[0].start_time
                const end_time = resultBooked.rows[0].end_time
                res.render("booked.ejs", {room:room, seat:seat, start_time:start_time, end_time:end_time})
            }else{
                res.render("home.ejs")
            }
        }catch(err){
            console.log(err)
        }
      
    } else {
      res.redirect("/login");
    }
  });


app.post("/login", function(req, res, next) {
  passport.authenticate("local", function(err, user, info) {
    if (err) { return next(err); }
    if (!user) {
      // Pass the warning message to the EJS template
      return res.render("login.ejs", { warning: "Password or email is wrong" });
    }
    // Authentication successful, redirect to home page
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.redirect("/home");
    });
  })(req, res, next);
});


app.post("/register", async (req,res)=>{
    console.log(req.body)
    let isWarning = false;
    const email = req.body.email;
    const password = req.body.password;
    const studentNumber = req.body.studentNumber;
    const major = req.body.major;
    try{
        const checkResult = await db.query("SELECT * FROM q_user WHERE email = $1", [email]);
        if(checkResult.rows.length > 0){
            isWarning = "Email already registered";
            res.render("register.ejs", {isWarning : isWarning});
        }else{
            bcrypt.hash(password, saltRounds, async(err, hash)=>{
                if(err){
                    console.log("ERROR HASHING PASSWORD", err);
                }else{
                    const result = await db.query(
                    "INSERT INTO q_user(email, userpassword, studentnumber,major) VALUES ($1, $2, $3, $4) RETURNING *",
                     [email, hash, studentNumber, major]   
                );
                const user = result.rows[0];
                req.login(user, (err)=>{
                    console.log("success");
                    res.redirect("/home");
                });
                }
            });
        }
        
    }catch(err){
        console.log(err);
    }
})

app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });

  app.get("/admin", (req,res)=>{
    res.render("adminLogin.ejs")
})

app.post("/admin-login", async (req,res)=>{
    const username = "admin"
    const password ="admin123"
    const result = req.body
    var dbResult
    try{
        console.log("ok")
        dbResult = await db.query("SELECT email, studentnumber, major from q_user");
    }catch(err){
        console.log(err)
    }

    if(username === req.body.username && password === req.body.password){
        res.render("adminHome.ejs",{data: dbResult.rows})
    }else{
        res.redirect("/admin")
    }
})

app.get("/admin-data", async(req,res)=>{
    try{
        console.log("ok")
        const dbResult = await db.query("SELECT email, studentnumber, major from q_user");
        res.render("adminHome.ejs",{data: dbResult.rows})
    }catch(err){
        console.log(err)
    }
})

app.get("/admin-logout", (req,res)=>{
    res.redirect("/admin")
})

app.get("/current", (req,res)=>{
    res.render("current.ejs")
})

app.post("/nextAdmin", async (req,res)=>{
    let status = 1
    const next = req.body
    let seats = []
    tempTime = next.selectedTime
    room = next.selectedRoom
    try{
    const result = await db.query(`SELECT seat_number FROM seat WHERE ${next.selectedTime} = $1`,[status])
    result.rows.forEach((seat) =>{
    seats.push(seat.seat_number)})
    res.render("bookingAdmin.ejs",{seats:seats}) 
    }catch(err){
        console.log(err)
    }
})

passport.use("local", new Strategy(async function verify(username, password, cb){
    try{
        const result = await db.query("SELECT * FROM q_user WHERE email = $1", [username])
        if(result.rows.length > 0){
            const user= result.rows[0]
            const storeHashedPassword = user.userpassword;
            bcrypt.compare(password, storeHashedPassword, (err, valid)=>{
                if(err){
                    console.error("ERROR COMPARING PASSWORD", err);
                    return cb(err);
                }else{
                    if(valid){
                        return cb(null, user);
                    }else{
                        return cb(null, false);
                    }
                }
            })
        }else{
            return cb(null,false)
        }
    }catch(err){
        console.log(err)
    }
}))

passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });

  async function updateStatusToComplete() {
    try {
        const currentTime = new Date();
        const status = 0;
        const result = await db.query("SELECT * FROM history WHERE status != 'Complete'");
        console.log(`Retrieved ${result.rows.length} records from the database.`);
        for (const record of result.rows) {
            const endTimeParts = record.end_time.split(":");
            const endHour = parseInt(endTimeParts[0], 10);
            const endMinute = parseInt(endTimeParts[1], 10);
            const endTime = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), endHour, endMinute);

            if (currentTime >= endTime) {
                await db.query("UPDATE history SET status = 'Complete' WHERE id = $1", [record.id]);
                const userHistory = await db.query("SELECT * FROM q_user JOIN history ON q_user.id = history.user_id WHERE history.id = $1", [record.id]);
                const timetoRelease = userHistory.rows[0].timebook; // Assuming the field name is timebook
                console.log(timetoRelease)
                const seat = userHistory.rows[0].seat_number; // Assuming the field name is seat_number
                const userIsBooked = userHistory.rows[0].user_id;
                await db.query(`UPDATE seat SET ${timetoRelease} = $1  WHERE seat_number = $2`, [status, seat]); // Assuming the column name is seat_number
                await db.query(`UPDATE q_user set is_booked = $1 where id = $2`, [status, userIsBooked])
                console.log(`Status updated to 'Complete' for record with ID ${record.id}`);
            }
        }
        console.log("Status update process completed.");
    } catch (error) {
        console.error("Error updating status:", error);
    }
}

// Define the interval (e.g., every minute)
const interval = 1 * 1000; // 60 seconds * 1000 milliseconds

// Start the interval
setInterval(updateStatusToComplete, interval);


app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});


