# Calview Deployment Guide

Complete step-by-step guide to deploy a full stack application on AWS Free Tier with CI/CD.

## Prerequisites

- AWS Account
    - You need THREE things (email address, phone number and a credit card)
- GitHub repository with your code (for example, this repository)
- Domain name (optional, can use S3/EC2 URLs directly)
    - Without a custom domain, your URL will look like https://dXXXXXXX.cloudfront.net or the raw S3/EC2 address

# Architecture Diagram 

Previous Architecture Diagram (routify.tech)
![Routify AWS Architecture Diagram](images/routify.png)

Current Architecture Diagram (https://calview.me)
![Routify AWS Architecture Diagram](images/calview.png)

For a detailed, step-by-step explanation of how GitHub Actions uses OIDC to access AWS resources—including how STS, IAM roles, and token claims work together, check out this guide on Qiita: [GitHub Actions with AWS](https://qiita.com/satooshi/items/0c2f5a0e2b64a1d9a4b3)  
It provides a granular look at the authentication flow, trust policies, and best practices for secure deployments.

## Step 1: Create AWS Account & IAM User

### 1.1 Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Complete signup with credit card (dw, you won't be charged if you are using free plan)

### 1.2 Create IAM User for Deployments

1. Go to **IAM → Users → Add users**  
2. **Username**: `calview-deployer`  
   - Check **“Provide user access to AWS Management Console”**  
   - Configure remaining settings as desired  
3. Choose **“Attach policies directly”**  
4. Add the following policy:  
   - `AdministratorAccess` (or select more specific policies based on your service usage)  
   - While this works perfectly for a tutorial to ensure no permission errors, it is technically "over-privileged."
5. Click **Create user**

> While you can technically deploy and launch services using your AWS root account, it is strongly discouraged. The root account has full unrestricted access to everything in your AWS account, so using it for day-to-day deployments or CI/CD poses a high security risk. Creating a dedicated IAM user with only the necessary permissions is also considered best practice. 

---

## Step 2: Create S3 Bucket for Frontend

### 2.1 Create Bucket

1. Go to **S3** → **Create bucket**
2. **Bucket name**: `calview-frontend` 
    - This must be globally unique
3. **Region**: Same as EC2 (us-east-1)
4. **Object Ownership**: ACLs disabled
5. **Block Public Access**: Uncheck "Block all public access"
   - Acknowledge the warning
6. Click **Create bucket**

### 2.2 Enable Static Website Hosting

1. Go to your bucket → **Properties**
2. Scroll to **Static website hosting** → **Edit**
3. Enable static website hosting
4. **Index document**: `index.html`
5. **Error document**: `index.html` (for React/Vite SPA routing)
6. Save changes

### 2.3 Add Bucket Policy

1. Go to **Permissions** → **Bucket policy**
2. Add this policy (replace `YOUR_BUCKET_NAME`. In our case, it would be `calview-frontend-yourname`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```
### 2.4 Build & Upload Your Frontend (React / Vite)

1. If you're using React or Vite, `npm run build`
    - This will generate a `dist/` folder (Vite), or  a `build/` folder (Create React App)

2. Upload **everything inside that folder** to your S3 bucket. It should contain files/folders such as:

- `index.html`  
- `assets/` (or `static/`)   

### 2.5 Get Your Website URL

1. Go to: S3 → Bucket → Properties → Static website hosting

You’ll see a URL like:
http://calview-frontend-yourname.s3-website-us-east-1.amazonaws.com

Congrats, that’s your live frontend hosted in AWS S3! You should notice the URL is using **HTTP**, not **HTTPS**. That’s expected at this stage because S3 static website endpoints do not support SSL directly. We’ll take care of the security and HTTPS setup later using CloudFront and a custom domain. For now, this is perfect for testing and development. Nothing to worry as your site is live and working.

---

## Step 3: Launch EC2 Instance

### 3.1 General Settings

1. Go to **EC2** → **Launch instance**
2. **Name**: `calview-backend`
3. **AMI**: Amazon Linux 2023 kernel-6.1 AMI
4. **Instance type**: `t3.micro` (free tier)
     - Choosing a higher-spec instance will increase costs, so `t3.micro` is a cost-effective option for testing and small workloads.
5. **Key pair**: Create new
   - Name: `calview-key` (or any name you prefer)  
   - Type: RSA
   - Format: .pem
   - **Download and save the .pem file!**
        - You’ll need it to access your instance.

### 3.2 Network Settings

1. **VPC**: default
2. **Auto-assign public IP**: Enable
3. **Security group**: Create new  
   - **Name**: `calview-ec2-sg` (or any name you prefer)  
   - **Rules**:  
     - **Type**: SSH, **Source type**: Anywhere, **Description**: Optional (Allows SSH from any device using the private key `calview-key.pem`)  
     - **Type**: HTTP, **Source type**: Anywhere  
     - **Type**: HTTPS, **Source type**: Anywhere  
     - **Type**: Custom TCP, **Port range**: 8000, **Source type**: Anywhere (API port)


### 3.3 Storage

- 8 GB gp3 (free tier: 30GB of EBS storage per month)

Click **Launch instance**

--- 

## Step 4: Create RDS PostgreSQL Database

### 4.1 Create Database

1. Go to **RDS** → **Create database**
2. Choose:
    - **Creation Method**: Full configuration
    - **Engine**: PostgreSQL
    - **Template**: Free tier
    - **DB instance identifier**: `calview-db`
    - **Master username**: `calview_user`
    - **Master password**: Create a strong password (save it!)
    - **Instance class**: `db.t3.micro` (or something in free tier)
    - **Storage**: 20 GB (free tier max)
    - Click on **Additional storage configuration**  
        - **Storage autoscaling**: Disable  
            - This prevents unexpected charges if the database reaches its storage limit.
    - **Compute resource**: Connect to EC2 instance.  
    - **EC2 instance**: Select `calview-backend`.
    - **DB subnet group**: Automatic setup.  
    - **Public access**: No — the DB will **not** have a public IP. Only EC2 instances in the VPC can access it.  
    - **VPC security groups**:  
        - Create new → VPC security group name: `ec2-rds-1` (attached to EC2)  
            - AWS will automatically create a new security group `rds-ec2-1` (attached to RDS)  
        - These SGs control which resources can communicate between EC2 and RDS.  

> RDS backups are incremental and free up to your database size (Free Tier). Small or lightly-used databases usually stay within this limit, but heavy daily writes or long backup retention can exceed free storage, potentially incurring extra charges. So, its safer to disable backups although shorter retention helps stay under the Free Tier.

3. Click **Create database** (takes 5-10 minutes)

### 4.2 Get Database Endpoint

After creating your database, go to the RDS console and copy the **Endpoint** (e.g., `calview-db.xxxx.us-east-1.rds.amazonaws.com`).

You will use this to form the PostgreSQL connection string:

`postgresql://<username>:<password>@<host>:<port>/<database>`

In our example:

`postgresql://calview_user:<password>@calview-db.xxxx.us-east-1.rds.amazonaws.com:5432/postgres`

> This connection string will be needed when you SSH into your EC2 instance and try to connect to the RDS database.

---

## Step 5: Set Up EC2 Server

### 5.1 Connect to EC2

1. Go to **EC2 → Instances → Your Instance → Connect**  
2. Set permissions for your key:

```bash
chmod 400 calview-key.pem
```

3. SSH into your instance:

```bash
# Replace the IP address with your EC2 Public IPv4 address (you can find it in Connect tab)
ssh -i "calview-key.pem" ec2-user@ec2-XX-XX-XX-XX.compute-1.amazonaws.com
```

### 5.2 Install Dependencies

```bash
# Update system packages
sudo dnf update -y

# Install Python, pip, git
sudo dnf install -y python3 python3-venv python3-pip git

# Install PostgreSQL client (for testing connection)
sudo dnf install -y postgresql15
```

### 5.3 Clone and Setup Project

```bash
# Clone your repo
git clone https://github.com/kyle-luong/calview.git
cd calview/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 5.4 Configure Environment Variables

```bash
# Create .env file
vi .env
```
Press i to enter insert mode, then paste the following (update the values):

```env
DATABASE_URL=postgresql://calview_user:<password>@calview-db.xxxx.us-east-1.rds.amazonaws.com:5432/postgres
GOOGLE_MAPS_API_KEY=your_key_here
ENVIRONMENT=production
ALLOWED_ORIGINS=["http://<bucket-name>.s3-website-us-east-1.amazonaws.com"]
```

### 5.5 Test Database Connection

```bash
# Syntax: psql -h <endpoint> -U <username> -d <database>
psql -h calview-db.xxxx.us-east-1.rds.amazonaws.com -U calview_user -d postgres

# Enter password when prompted
# If connected, type \q to exit
```

### 5.6 Test Application

```bash
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Visit `http://YOUR_EC2_IP:8000/health` to test the application.  
    - Replace `YOUR_EC2_IP` with the Public IP or DNS of your EC2 instance (e.g., `ec2-XX-XX-XX-XX.compute-1.amazonaws.com`).  
    - You should see a **healthy** response on the page.
- If it works, press Ctrl+C to stop the server.

### 5.7 Setup Systemd Service

```bash
# Navigate to the project folder
cd ~/calview

# Copy the service file to the system directory
sudo cp calview.service /etc/systemd/system/

# Edit if your username/filepath is different
sudo vi /etc/systemd/system/calview.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable calview
sudo systemctl start calview

# Check status
sudo systemctl status calview
```

---