const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectToDatabase = async () => {
 
  if (mongoose.connection.readyState === 0) {
    try {
      
      const atlasConnectionUri =
        "mongodb+srv://proshantosaha1999:W0ZsFvmK5dmk5ayU@cluster0.hwzdkym.mongodb.net/";

      await mongoose.connect(atlasConnectionUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ssl: true,
      });

      console.log("Connected to MongoDB Atlas");

      //await createAdminUser();

    } catch (error) {
      console.error("MongoDB Connection Error:", error);
    }
  }
};


const createAdminUser = async () => {
  try {
    const adminUsername = "proshanto";
    const adminPassword = "123456"; 

    const adminUser = new Admin({
      full_name: "proshanto",
      email: "proshanto@gmail.com",
      password: adminPassword,
    });

    await adminUser.save();

    console.log("Admin user created successfully");
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
};


const adminSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: "Admin",
  },
});



const engineerSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
  },
  designation: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  field_of_expertise: {
    type: String,
    required: true,
  },
  location: {
    type: String,
  },
  website: {
    type: String,
  },
  github: {
    type: String,
  },
  twitter: {
    type: String,
  },
  instagram: {
    type: String,
  },
  facebook: {
    type: String,
  },
  skill: {
    type: String,
  },
  experience: {
    type: String,
  },
  education: {
    type: String,
  },
  address: {
    type: String,
  },
  profilePicPath: {
    type: String, 
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  cardHolderName: {
    type: String,
    
  },
  cardNumber: {
    type: String,
   
  },
  cardExpMonth: {
    type: String,
   
  },
  cardExpYear: {
    type: String,
    
  },
  cardCVV: {
    type: String,
    
  },
  balance: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
 
});

const jobSchema = new mongoose.Schema({
  jobTitle: {
    type: String,
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client", 
  },

  clientName: {
    type: String,
  },

  category: {
    type: String,
    required: true,
  },
  specifiedCategory: {
    type: String,
  },
  jobDetails: {
    type: String,
    required: true,
  },
  jobRequirements: {
    type: String,
    required: true,
  },
  jobLocation: {
    type: String,
    required: true,
  },
  jobDeadline: {
    type: Date, 
    required: true,
  },
  jobPriceRange: {
    type: Number,
    required: true,
  },
});

const clientSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  website: {
    type: String, 
  },
  twitter: {
    type: String, 
  },
  instagram: {
    type: String, 
  },
  facebook: {
    type: String, 
  },
  address: {
    type: String, 
  },
  profilePicPath: {
    type: String, 
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  cardHolderName: {
    type: String,
    
  },
  cardNumber: {
    type: String,
   
  },
  cardExpMonth: {
    type: String,
   
  },
  cardExpYear: {
    type: String,
    
  },
  cardCVV: {
    type: String,
    
  },
  balance: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
});

const bidSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
  },
  engineer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engineer",
    required: true,
  },

  client: {
    type: String,
  },

  engineerFullName: {
    type: String,
  },
  jobTitle: {
    type: String,
  },
  jobDeadline: {
    type: Date,
  },

  bidAmount: {
    type: Number,
    required: true,
  },
  bidDetails: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending", 
  },
  
});



const workSchema = new mongoose.Schema({
  engineer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engineer",
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
  },
  bid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bid",
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },
  paymentComplete: {
    type: Boolean,
    default: false,
  },
  ratedByEngineer: {
    type: Boolean,
    default: false,
  },
  ratedByClient: {
    type: Boolean,
    default: false,
  },

  clientChatMessages: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
      },
      message: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  engineerChatMessages: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Engineer",
      },
      message: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  clientRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },
  clientFeedback: String,

  engineerRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },
  engineerFeedback: String,
});



const paymentSchema = new mongoose.Schema({
  engineer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Engineer',
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
  },
  work: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Work',
  },
  amount: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});



engineerSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});

clientSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});

adminSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});


workSchema.post("save", async function (doc, next) {
  try {
    const { client, engineer, clientRating, engineerRating } = doc;

    // Calculate average client rating
    const avgClientRating = await Work.aggregate([
      { $match: { client, clientRating: { $exists: true } } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$clientRating" },
        },
      },
    ]);

    // Update client schema with average rating
    if (avgClientRating.length > 0) {
      await Client.findByIdAndUpdate(client, {
        rating: avgClientRating[0].averageRating || 0,
      });
    }

    // Calculate average engineer rating
    const avgEngineerRating = await Work.aggregate([
      { $match: { engineer, engineerRating: { $exists: true } } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$engineerRating" },
        },
      },
    ]);

    // Update engineer schema with average rating
    if (avgEngineerRating.length > 0) {
      await Engineer.findByIdAndUpdate(engineer, {
        rating: avgEngineerRating[0].averageRating || 0,
      });
    }

    next();
  } catch (error) {
    console.error("Error updating average ratings:", error);
    next(error);
  }
});



const Engineer = mongoose.model("Engineer", engineerSchema);
const Job = mongoose.model("Job", jobSchema);

const Bid = mongoose.model("Bid", bidSchema);
const Work = mongoose.model("Work", workSchema);

const Client = mongoose.model("Client", clientSchema);
const Admin = mongoose.model("Admin", adminSchema);
const Payment = mongoose.model('Payment', paymentSchema);


module.exports = { Job, Engineer, Client, Bid, Work,Admin,Payment,connectToDatabase };
