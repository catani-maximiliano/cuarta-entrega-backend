const passport = require("passport");
const Route = require("../../router/Class.Router");
const NodemailerAdapter = require("../../adapters/nodemailer.adapter");
const correo = new NodemailerAdapter();
const {
  UserManager,
} = require("../../dao/mongoClassManagers/userClass/userMongoManager");
const userBD = new UserManager();
const {
  isValidPasswordMethod,
  createHash,
} = require("../../utils/cryptPassword");

class AuthRouter extends Route {
  init() {
    this.post(
      "/",
      ["PUBLIC"],
      passport.authenticate("login", {
        failureRedirect: "/api/auth/failLogin",
      }),
      async (req, res) => {
        try {
          if (!req.user) {

            return res.status(400).json({ error: "Credenciales inválidas" });
          } else {
            console.log(req.user)
            req.session.destroy
            req.session.user = {
              first_name: req.user.first_name,
              last_name: req.user.last_name,
              age: req.user.age,
              email: req.user.email,
              role: "usuario",
              last_connection: req.user.last_name,
            };

            const dateNow = new Date();
            await userBD.updateConnection(req.user.email, dateNow);

            res.sendSuccess(req.user);
          }
        } catch (error) {
          req.logger.error("Usuario no autenticado");
        }
      }
    );

    this.post("/passwordReset", ["PUBLIC"], async (req, res) => {
      try {
        const expirationTime = new Date().getTime() + 3600000;
        let linkMold = req.protocol + "://" + req.get("host");
        const url = linkMold + `/passwordReset/${expirationTime}`;
        const email = { email: req.body.user };
        req.session.destroy;
        req.session.expirationTime = expirationTime;
        req.session.email = email;
        const mensaje = {
          message: `<div> 
                      <h2>"Este es el enlace para restablecer tu contraseña</h2> 
                      <h3> ${url}</h3> 
                    </div>`,
          subject: "Recuperacion  de contraseña",
        };
        const emailSend = await correo.sendNotification(email, mensaje);
        console.log(emailSend);
        res.json({ emailSend });
      } catch (error) {
        res.sendServerError(`something went wrong ${error}`);
      }
    });

    this.post("/passwordUpdate", ["PUBLIC"], async (req, res) => {
      try {
        const { newPassword1, newPassword2 } = req.body;
        const email = req.session.email.email;
        const user = await userBD.findUser(email);

        if (newPassword1 === newPassword2) {
          if (isValidPasswordMethod(newPassword1, user)) {
            res.json({
              mesagge: "contraseña anteriormente utilizada, utilice una nueva.",
            });
          } else {
            await userBD.updatePassword(email, createHash(newPassword1));
            res.json({ mesagge: "Contraseña actualizada" });
          }
        } else {
          res.json({ mesagge: "Contraseña o usuario no coinciden." });
        }
      } catch (error) {
        res.sendServerError(`something went wrong ${error}`);
      }
    });

    this.get("/failLogin", ["PUBLIC"], (req, res) => {
      try {
        res.json({ error: "Fallo del login" });
      } catch (error) {
        res.sendServerError(`something went wrong ${error}`);
      }
    });

    this.get(
      "/github",
      ["PUBLIC"],
      passport.authenticate("github", { scope: ["user:email"] }),
      async (req, res) => {}
    );

    this.get(
      "/githubcallback",
      ["PUBLIC"],
      passport.authenticate("github", { failureRedirect: "/login" }),
      async (req, res) => {
        try {
          req.session.user = req.user;
          const dateNow = new Date();
          await userBD.updateConnection(req.user.email, dateNow);
          res.redirect("/products");
        } catch (error) {
          res.sendServerError(`something went wrong ${error}`);
        }
      }
    );

    this.get(
      "/google",
      ["PUBLIC"],
      passport.authenticate("google", { scope: ["profile"] }),
      async (req, res) => {}
    );

    this.get(
      "/google/callback",
      ["PUBLIC"],
      passport.authenticate("google", { failureRedirect: "/login" }),
      async (req, res) => {
        try {
          req.session.user = req.user;
          const dateNow = new Date();
          await userBD.updateConnection(req.user.email, dateNow);
          res.redirect("/products");
        } catch (error) {
          res.sendServerError(`something went wrong ${error}`);
        }
      }
    );

    this.get("/logout", ["PUBLIC"], (req, res) => {
      try {
        req.session.destroy((err) => {
          if (err) {
            res.json({ msg: err });
          }
          res.redirect("/login");
        });
      } catch (error) {
        res.sendServerError(`something went wrong ${error}`);
      }
    });
  }
}

module.exports = AuthRouter;
