# Gone Man's Switch

Gone Man's Switch is a simple web application that allows you to create **messages** that will be delivered by email when you are absent (gone) for a certain period.

You can think of a message as an email, it has a set of recipients, a subject, a body, and an optional attachment file. Messages also have a section called check-in configuration, where you specify how often you want the system to check on you by sending you check-in notification emails, and what is the maximum amount of time the system will wait for you to respond to those notifications before delivering the message.

## Features

<img src="./public/images/icon.png" width="48">

### Attachments

You can attach any type of file to a message, which will be delivered as an email attachment. The maximum size supported is 20MB.

### Message Body Encryption

By default, the message body is stored as plain text in the system's database. However, you can choose to encrypt it, these are the available encryption options:

| Option                                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Recipients receive                                                                                                                                                                                                      | Message body is stored internally as | Can the system decrypt the message body by itself? |
|------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------|----------------------------------------------------|
| Unencrypted                              |  The message body is stored as plain text in the system database.  Use this option if you are not sending sensitive information such  as passwords, or if you are confident that nobody will have access  to the system's database.                                                                                                                                                                                                                                                        | The same message you type in the body field                                                                                                                                                                       | Plain text in the database           | Yes                                                |
| Encrypt using system encryption password |  The message body is stored in encrypted format in the system database.  The encryption password comes from the system environment variable `MESSAGE_ENCRYPTION_PASSWORD`. This adds a layer of protection in the sense that to be able to read the message body the intruder  would not only need to have access to the system's database, but also to  the system environment variables, and know the system's  encryption logic.                                       | The same message you type in the body field                                                                                                                                                                       | Encrypted format in the database     | Yes                                                |
| Encrypt using custom encryption password |  The message body is stored in encrypted format in the system database.  The encryption password comes from the user when creating/updating the message. Because  this encryption password is not stored anywhere, the recipients will have to  enter this encryption password when reading the message.  This is the most secure option, but if they don't manage to guess your  encryption password with the hint you gave them, they won't be able to see the content  of your message. | A standard message containing a link to decrypt the message and the encryption password hint. Once the recipient opens the link, the system will ask for the encryption password and then show the message body content | Encrypted format in the database     | No                                                 |

### Test SMTP Configuration

You can check if your SMTP settings are valid by sending a test email from within the system. Login as an ADMIN user,  go to the System module, and click the button **Send Test Email**.

### Account Module

Using the account module you can update your account information, such as username, email, or changing your password.

### System Module

Using the system module you can see the current system settings. You can also send test emails to verify your SMTP configuration.

### Users Module

Using the users module you create, edit and delete users. New users can login and user the system too. There are 2 type of users:
- `ADMIN`: They can create and manage messages, update their account, and access the modules Users and System, meaning they can manage users, see the system information, and send test emails.
- `USER`: They can create and manage messages, and update their account.

## Installation / Setup

> [!NOTE]
> These instructions require Docker and optionally Docker Compose. However, you can follow a bare-metal installation by simply installing Node.js and following the steps in the [_Local Development_](#local-development) section

To install the latest version of the system using docker you can simply run:
```bash
docker run --name gonemanswitch -v ./:/app/data -p 3000:3000 --restart on-failure jhonderson/gone-man-switch:latest
```

You can also use docker-compose, creating a `docker-compose.yml` file, like [the one in this repo](./docker-compose.yml):
```yaml
version: '3.8'
services:
  gone-man-switch:
    container_name: gonemanswitch
    volumes:
    # The path to the left is the path where you want to store the SQLite database file
      - './:/app/data'
    ports:
      - '3000:3000'
    # environment:
    #  - 'SERVER_URL=https://yourcustomdomain'
    #  - 'COOKIE_SESSION_SECRET=any-secret-random-string-will-do'
    #  - 'MESSAGE_ENCRYPTION_PASSWORD=any-secret-string-will-do'
    # This example uses Microsoft SMTP server configs, you can use any SMTP service
    #  - 'SMTP_HOST=smtp-mail.outlook.com'
    #  - 'SMTP_PORT=587'
    #  - 'SMTP_SECURE=false'
    #  - 'SMTP_FROM=youremail@hotmail.com'
    #  - 'SMTP_USERNAME=youremail@hotmail.com'
    #  - 'SMTP_PASSWORD=your-app-password'
    #  - 'SMTP_AUTH_MECHANISM=Login'
    restart: on-failure
    image: jhonderson/gone-man-switch:latest
```

And running `docker-compose up -d`.

Just like that the system will be up and running in http://localhost:3000, and you can use the username `admin` and password `password` to log in (this default credentials can be customized).

However, for the system to be fully functional, we recommend setting up the following environment variables:
- `SMTP_HOST`: Hostname or IP address to connect to
- `SMTP_PORT`: Port to connect to
- `SMTP_SECURE`:  if true the connection will use TLS when connecting to server. If `false` (the default) then TLS is used if server supports the STARTTLS extension. In most cases set this value to true if you are connecting to port 465. For port 587 or 25 keep it `false`
- `SMTP_FROM`:  The email address of the sender. All email addresses can be plain `sender@server.com` or formatted `"Sender Name" sender@server.com`
- `SMTP_USERNAME`: Username
- `SMTP_PASSWORD`: Password for the user, or application password
- `SMTP_AUTH_MECHANISM`: Indicates the authetication type
- `SERVER_URL`: This the url used by the system to generate external links, such as the link sent for you to check-in, or the link sent to recipients to decrypt a message. Relevant when you exposing this application to the public. It defaults to `http://localhost:3000`
- `COOKIE_SESSION_SECRET`: Secret used by the [cookie-session](https://www.npmjs.com/package/cookie-session) library to sign the cookie session and prevent tampering. Any secret random string will sufice
- `MESSAGE_ENCRYPTION_PASSWORD`: Encryption password used to encrypt the body of messages for which encryption was configured as **Encrypt using system encryption password**. Any secret string will sufice

You can read more about SMTP configuration options [here](https://nodemailer.com/smtp/). You can validate your SMTP settings by using the feature [_Test SMTP Configuration_](#test-smtp-configuration).

Additional environment variables you can configure:
- `DEFAULT_ADMIN_USER_EMAIL`: Username of the default user/account created by the system the first time it starts
- `DEFAULT_ADMIN_USER_PASSWORD`: Password of the default user/account created by the system the first time it starts
- `COOKIE_SESSION_MAX_AGE_DAYS`: Maximum number of days the session will last
- `SQLITE_DB_PATH`: SQLite database path
- `CHECKIN_NOTIFICATIONS_JOB_CRON`: [Cron schedule expression](https://www.npmjs.com/package/node-schedule#cron-style-scheduling) for the job that sends check-in notifications. It runs daily at 8:00 am by default (`0 8 * * *`)
- `MESSAGES_JOB_CRON`: [Cron schedule expression](https://www.npmjs.com/package/node-schedule#cron-style-scheduling) for the job that delivers messages. It runs daily at 8:00 am by default (`0 8 * * *`)

Unless you plan on respond to your check-in notifications from within your local network, we recommend you to exposing this web application to the public using a reverse proxy and your custom domain provider.

## Local Development

> [!NOTE]
> Make sure you have Node.js >=v18 installed

Download or checkout this repository:
```
git clone https://github.com/jhonderson/gone-man-switch.git
```

Install dependencies:
```
npm install
```

Configure any environment variable you want in the file `.env`, and start the system:
```
node ./bin/www
```

The system will be up and running in http://localhost:3000

## FAQ

### Can you show me an example of how it works?

Let's say you create a message with the following information:
- Recipients: `bob@hotmail.com, lily@gmail.com`
- Subject: `Important message for you`
- Body: `Hello, here is some important information I want you to have...`
- Send me a check-in notification every: `6 Months`
- Deliver this message if I don't respond to my check-in notification after: `10 Days`

6 months after you create this message you will receive a check-in notification email like this:
```
From:
  your-smtp-from-email@domain.com
Subject:
  Gone Man's Switch - Check-in Notification
Body:
  Hello,

  Could you please confirm you are still available using the following link?: http://localhost:3000/checkin/loooooongcode

  Thanks!
```

Then 2 things may happen:
1. If you confirm the notification by clicking the link within 10 days of receiving it, the message won't be delivered and you will get another notification 6 months later.
1. If you do not confirm the notification within 10 days of receiving it, the message will be delivered to the recipients (`bob@hotmail.com, lily@gmail.com`) and deleted from the system. 

### What happens to the message information once it is delivered?

Once delivered, the message information is deleted from the system.

### Is the message body store as plain text?

By default yes, but you can choose to encrypt it using either the server encryption password or a custom encryption password provided by you. See more in the [_Message Body Encryption_](#message-body-encryption) section.

### Can I configure encryption for attachments?

The system doesn't support encrypting attachments at the moment. But you are welcome to encrypt the attachment before uploading it and providing information to the recipients on how to decrypt it.

### How do I know if my SMTP configurations are valid?

You can send a test email from the web UI. See more in the [_Test SMTP Configuration_](#test-smtp-configuration) section.

### Can I invite other users to use my system instance?

Yes, as an administrator you can create other users. Those users can log in and configure their messages. See more in the [_Users Module_](#users-module) section.

## Screenshots

Login:

<img src="./screenshots/login.png" width="700">

Home:

<img src="./screenshots/home.png" width="700">

System:

<img src="./screenshots/system.png" width="700">