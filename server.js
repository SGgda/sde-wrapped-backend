const express = require("express");
const app = express();
app.use(express.json());
const dotenv = require("dotenv");
dotenv.config();
const session=require('express-session');
const PORT=process.env.PORT||3000;

const cors=require('cors');
app.use(cors({
  origin: ["http://localhost:5173",
  "https://sde-wrapped-frontend.vercel.app"],
  credentials: true
}));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // true if using HTTPS
  })
);
app.get("/", (req, res) => {
  res.send("SDE Wrapped backend is running 🚀");
});


app.get("/auth/github", (req, res) => {
  const githubAuthURL =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&scope=read:user`;
  res.redirect(githubAuthURL);
});

const axios = require("axios");

app.get("/auth/github/callback", async (req, res) => {
  const code = req.query.code;

  try {
    // STEP 1: Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // STEP 2: Use token to fetch GitHub user
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("GitHub Username:", userResponse.data.login);

    // res.send(`Welcome ${userResponse.data.login}`);

    const repoResponse = await axios.get(
      "https://api.github.com/user/repos?per_page=100",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const repos = repoResponse.data;
    console.log("Total repos:", repos.length);
    console.log("First repo name:", repos[0]?.name);

    let totalStars = 0;
    let totalForks = 0;
    let languageCount = {};
    let topRepo = null;

    repos.forEach((repo) => {
      totalStars += repo.stargazers_count;
      totalForks += repo.forks_count;

      // Count languages
      if (repo.language) {
        languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
      }

      // Find top repo (by stars)
      if (!topRepo || repo.stargazers_count > topRepo.stargazers_count) {
        topRepo = repo;
      }
    });

    // Find most used language
    let mostUsedLanguage = null;
    let maxCount = 0;
    for (let lang in languageCount) {
      if (languageCount[lang] > maxCount) {
        maxCount = languageCount[lang];
        mostUsedLanguage = lang;
      }
    }

    console.log("Total stars:", totalStars);
    console.log("Total forks:", totalForks);
    console.log("Most used language:", mostUsedLanguage);
    console.log("Top repo:", topRepo.name);

    const wrappedData = {
    username: userResponse.data.login,
    totalRepos: repos.length,
    totalStars,
    totalForks,
    mostUsedLanguage,
    topRepo: topRepo.name
    };
    // console.log(wrappedData);
    // res.json(wrappedData);
    req.session.wrappedData = wrappedData;
    res.redirect("http://localhost:5173")
    

    


  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("OAuth failed");
  }
});

app.get("/api/wrapped", (req, res) => {
  if (!req.session.wrappedData) {
    return res.status(401).json({ error: "Not authenticated yet" });
  }

  res.json(req.session.wrappedData);
});
app.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }

    res.clearCookie("connect.sid"); // session cookie
    res.json({ message: "Logged out successfully" });
  });
});

app.get("/test", (req, res) => {
  res.json({
    message: "Route is working",
  });
});

app.listen(PORT, () => {
  console.log(`App running at port ${PORT}`);
});
