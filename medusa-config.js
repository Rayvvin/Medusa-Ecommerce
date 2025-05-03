const dotenv = require("dotenv");
const path = require("path");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  case "production":
    ENV_FILE_NAME = ".env.production";
    break;
  case "staging":
    ENV_FILE_NAME = ".env.staging";
    break;
  case "test":
    ENV_FILE_NAME = ".env.test";
    break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) {}

// CORS when consuming Medusa from admin
const ADMIN_CORS =
  process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001";

// CORS to avoid issues when consuming Medusa from a client
const STORE_CORS = process.env.STORE_CORS || "http://localhost:8000,http://localhost:8005";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/medusa-store";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const REDIS_URLL = process.env.REDIS_URLL || "redis://localhost:6379";

const plugins = [
  `medusa-fulfillment-manual`,
  `medusa-payment-manual`,
  {
    resolve: `medusa-payment-paystack`,
    /** @type {import("medusa-payment-paystack").PluginOptions} */
    options: {
      secret_key: process.env.PS_KEY,
    },
  },
  {
    resolve: `medusa-payment-flutterwave-pro`,
    /** @type {import("medusa-payment-flutterwave-pro").PluginOptions} */
    options: {
      secret_key: process.env.FW_KEY,
    },
  },
  {
    resolve: `medusa-storage-supabase`,
    options: {
      referenceID: process.env.STORAGE_BUCKET_REF,
      serviceKey: process.env.STORAGE_SERVICE_KEY,
      bucketName: process.env.BUCKET_NAME,
    },
  },
  {
    resolve: "@medusajs/admin",
    /** @type {import('@medusajs/admin').PluginOptions} */
    options: {
      autoRebuild: true,
      develop: {
        open: process.env.OPEN_BROWSER !== "false",
      },
    },
  },
  {
    resolve: `medusa-payment-stripe`,
    options: {
      api_key: process.env.STRIPE_API_KEY,
      webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
      automatic_payment_methods: true,
      capture: true
    },
  },
  {
    resolve: `medusa-plugin-smtp`,
    options: {
      fromEmail: "rayvvin01@gmail.com",
      // this object is input directly into nodemailer.createtransport(), so anything that works there should work here
      // see: https://nodemailer.com/smtp/#1-single-connection and https://nodemailer.com/transports/
      transport: 
      // {
      //   host: process.env.SMTP_HOST,
      //   port: process.env.SMTP_PORT,
      //   secure: false, // true for 465, false for other ports
      //   auth: {
      //     user: process.env.SMTP_USER,
      //     pass: process.env.SMTP_PASS,
      //   },
      // }
      // an example for an office365 smtp transport:
      {
          host: "smtp.gmail.com",
          port: 587,
          secureConnection: false,
          auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
          },
          tls: {
              ciphers: "SSLv3",
          },
          requireTLS: true,
      },
      // this is the path where your email templates are stored
      emailTemplatePath: "data/emailTemplates",
      // this maps the folder/template name to a medusajs event to use the right template
      // only the events that are registered here are subscribed to
      templateMap: {
          // "eventname": "templatename",
          "order.placed": "orderplaced",
      },
  }
  }
];

const modules = {
  // Uncomment and configure eventBus and cacheService if needed
  // eventBus: {
  //   resolve: "@medusajs/event-bus-redis",
  //   options: {
  //     redisUrl: REDIS_URL,
  //   },
  // },
  // cacheService: {
  //   resolve: "@medusajs/cache-redis",
  //   options: {
  //     redisUrl: REDIS_URL,
  //   },
  // },
};

const projectConfig = {
  jwtSecret: process.env.JWT_SECRET,
  cookieSecret: process.env.COOKIE_SECRET,
  store_cors: STORE_CORS,
  database_url: DATABASE_URL,
  admin_cors: ADMIN_CORS,
  // Uncomment the following lines to enable REDIS
  // redis_url: REDIS_URL
};
const featureFlags = {
  product_categories: true,
};

module.exports = {
  projectConfig,
  plugins,
  modules,
  featureFlags
};
