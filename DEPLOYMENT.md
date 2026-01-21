# Calview Deployment Guide

Complete step-by-step guide to deploy a full stack application on AWS Free Tier with CI/CD.

## Prerequisites

- AWS Account
    - You need THREE things (email address, phone number and a credit card)
- GitHub repository with your code (for example, this repository)
- Domain name (optional, can use S3/EC2 URLs directly)
    - Without a custom domain, your URL will look like https://dXXXXXXX.cloudfront.net or the raw S3/EC2 address

## Step 1: Create AWS Account & IAM User

### 1.1 Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Complete signup with credit card (You won't be charged if you are using free plan)

### 1.2 Create IAM User for Deployments

1. Go to **IAM → Users → Add users**  
2. **Username**: `calview-deployer`  
   - Check **“Provide user access to AWS Management Console”**  
3. Choose **“Attach policies directly”**  
4. Add the following policy:  
   - `AdministratorAccess`
   - While this works perfectly for a tutorial to ensure no permission errors, it is technically "over-privileged."
5. Click **Create user**

> While you can technically deploy and launch services using your AWS root account, it is strongly discouraged. The root account has full unrestricted access to everything in your AWS account, so using it for day-to-day deployments or CI/CD poses a high security risk. Creating a dedicated IAM user with only the necessary permissions is also considered best practice. 

---

## Step 2: Create S3 Bucket for Frontend

### 2.1 Create Bucket

1. Go to **S3** → **Create bucket**
2. **Bucket name**: `calview-frontend` (Must be globally unique)
3. **Region**: Same as EC2 (us-east-1)
4. **Object Ownership**: ACLs disabled
5. **Block Public Access**: Uncheck "Block all public access"
   - Check the box to acknowledge the warning.
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
2. Add this policy (replace `YOUR_BUCKET_NAME` with the name from Step 2.1.2`):

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
2. Upload the contents of the `dist/` or `build/` folder to your S3 bucket.
    - You should see `index.html` and an `assets` folder in the bucket root.

### 2.5 Get Your Website URL

1. Go to: S3 → Bucket → Properties → Static website hosting

You’ll see a URL like:
http://calview-frontend-yourname.s3-website-us-east-1.amazonaws.com

Congrats, that’s your live frontend hosted in AWS S3! You should notice the URL is using **HTTP**, not **HTTPS**. That’s expected at this stage because S3 static website endpoints do not support SSL directly. We’ll take care of the security and HTTPS setup later using CloudFront and a custom domain. For now, this is perfect for testing and development.

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
   - Type: RSA (.pem)
   - **Download and save the .pem file!**
        - You’ll need it to access your instance and for Step 5 and 8.

### 3.2 Network Settings

1. **VPC**: default
2. **Auto-assign public IP**: Enable
3. **Security group**: Create new  
   - **Name**: `calview-ec2-sg` (or any name you prefer)  
   - **Rules**:  
     - **Type**: SSH, **Source type**: My IP (Best for security) or Anywhere, **Description**: Optional (Allows SSH from any device using the private key `calview-key.pem`)  
     - **Type**: HTTP, **Source type**: Anywhere  
     - **Type**: HTTPS, **Source type**: Anywhere  
     - **Type**: Custom TCP, **Port range**: 8000, **Source type**: Anywhere (This is your API port)


### 3.3 Storage

- 8 GB gp3 (free tier: 30GB of EBS storage per month)

Click **Launch instance**

--- 

## Step 4: Create RDS PostgreSQL Database

### 4.1 Create Database

1. Go to **RDS** → **Create database**
2. **Creation Method**: Full configuration
3. **Engine**: PostgreSQL
4. **Template**: Free tier
5. **Settings**:
    - **DB instance identifier**: `calview-db`
    - **Master username**: `calview_user`
    - **Master password**: Create a strong password (save it!)
6. **Instance class**: `db.t3.micro` (or something in free tier)
7. **Storage**: 20 GB (free tier max)
    - Click on **Additional storage configuration**  
        - **Storage autoscaling**: Disable  
            - This prevents unexpected charges if the database reaches its storage limit.
8. **Connectivity**:
    - **Connect to EC2 instance**: Select `calview-backend` (from Step 3).
    - **DB subnet group**: Automatic setup.  
    - **Public access**: No. Only EC2 instances in the VPC can access it.  
    - **VPC security groups**:  
        - Create new → VPC security group name: `ec2-rds-1` (attached to EC2)  
9. Click **Create database** (takes 5-10 minutes)

> RDS backups are incremental and free up to your database size (Free Tier). Small or lightly-used databases usually stay within this limit, but heavy daily writes or long backup retention can exceed free storage, potentially incurring extra charges. So, its safer to disable backups although shorter retention helps stay under the Free Tier.

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
sudo dnf update -y
sudo dnf install -y python3 python3-venv python3-pip git postgresql15
```

### 5.3 Clone and Setup Project

```bash
git clone https://github.com/kyle-luong/calview.git
cd calview/backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

### 5.4 Configure Environment Variables

```bash
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
cd ~/calview
# Verify file content
cat calview.service

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

## Step 6: Set Up CloudFront (HTTPS & CDN)

CloudFront caches your content globally to improve performance and provides free SSL (HTTPS) for your website.

### 6.1 Request an SSL Certificate (Custom Domain Only)
*Skip this step if you do not have a custom domain (e.g., `calview.me`). You will use the default CloudFront URL instead.*

1. Go to **AWS Certificate Manager (ACM)** within the **us-east-1 (N. Virginia)** region.
    > **Note:** CloudFront certificates *must* be in `us-east-1`, regardless of where your infrastructure is.
2. Click **Request**.
3. Select **Request a public certificate**.
4. **Domain names:** Enter your root domain (e.g., `calview.me`)
5. **Validation method:** DNS validation (recommended).
6. Click **Request**.
7. **Validate the Certificate:**
    - Click on the Certificate ID you just created.
    - Find the **CNAME name** and **CNAME value** listed under "Domains".
    - Go to your DNS Provider (GoDaddy, Namecheap, Route53, etc.) and add this **CNAME record**.
        - When entering the Host (sometimes called Name), make sure not to include the trailing domain name. For example, if ACM gives you `_abcd1234.calview.me` as the CNAME name and `_xyz5678.acm-validations.aws` as the value, you would enter `_abcd1234` in the Host field and `_xyz5678.acm-validations.aws` in the Value field in NameCheap.
    - Wait for the status to change from "Pending validation" to "Issued" (can take 5-30 mins).

### 6.2 Create CloudFront Distribution

1. Go to **CloudFront** → **Create distribution**.
2. **Origin Settings:**
    - **Origin Domain:** Select your S3 bucket (`calview-frontend...`) from the dropdown.
3. Use recommended origin/cache settings → Tailored for S3.
4. **Web Application Firewall (WAF):**
    - Select **Do not enable security protections** (to stay in Free Tier).
5. Click **Create distribution**.
6. Go to **General** → **Settings** → **Edit**.
    - **Alternate domain name (CNAME):** Enter your domain (e.g., `calview.me`, `www.calview.me`).
    - **Custom SSL certificate:** Select the ACM certificate you created in Step 6.1.
    - **Default root object:** `index.html`

> **Note:** It may take 10-15 minutes for the distribution to deploy.

### 6.3 Configure DNS (Point Domain to CloudFront)
*Skip this if you are not using a custom domain.*

1. Copy your **Distribution Domain Name** (e.g., `d12345abcdef.cloudfront.net`) from the CloudFront console.
2. Go to your DNS Provider settings.
3. **For the root domain (`calview.me`):**
    - **Type:** ALIAS or ANAME (if supported) OR CNAME (if your provider supports CNAME flattening).
    - **Host:** `@`
    - **Value:** Your CloudFront URL.
4. **For the subdomain (`www.calview.me`):**
    - **Type:** CNAME
    - **Host:** `www`
    - **Value:** Your CloudFront URL.

### 6.4 Verification
Visit your domain (or the CloudFront URL `https://dXXXX.cloudfront.net` if you didn't use a domain). You should see your website served securely over HTTPS.

### 6.5 Set Up CloudFront for Backend (EC2)

This puts your EC2 instance behind the CDN, giving it SSL (HTTPS) and a custom domain.

1.  Go to **CloudFront** → **Create distribution**.
2.  **Origin Settings:**
    * **Origin Domain:** Enter your EC2 Public IPv4 DNS (e.g., `ec2-XX-XX-XX-XX.compute-1.amazonaws.com`).
    * **Protocol:** **HTTP only** (Important! Your EC2 does not have SSL).
    * **HTTP Port:** **8000** (Important! Your app runs on port 8000).
3.  Use recommended origin/cache settings.
4. **Web Application Firewall (WAF):**
    - Select **Do not enable security protections** (to stay in Free Tier).
5. Click **Create distribution**.
6. Go to **General** → **Settings** → **Edit**.
    * **Alternate domain name (CNAME):** `api.calview.me` (or your custom domain).
    * **Custom SSL certificate:** Select your ACM certificate (the same one you created earlier; it should cover `*.calview.me`).


### 6.7 Configure DNS (Route 53 or Other)

Point your custom subdomain to the new CloudFront distribution.

1.  Copy the **Distribution Domain Name** for your **Backend** (e.g., `d999xyz.cloudfront.net`).
2.  Go to your DNS Provider (Route 53, GoDaddy, etc.).
3.  Create a new record:
    * **Record Name:** `api` (for `api.calview.me`)
    * **Type:** CNAME
    * **Value:** Paste the CloudFront Distribution Domain Name (`d999xyz.cloudfront.net`).
    * *(If using Route 53, you can use an "A" record with "Alias" set to Yes, but CNAME works everywhere).*

### 6.4 Final Verification

1.  **Wait:** CloudFront takes 5–10 minutes to deploy.
2.  **Test API:** Visit `https://api.calview.me/health`.
    * You should see your JSON response (e.g., `{"status": "healthy"}`).
    * Note the lock icon indicating secure HTTPS.
3.  **Test Frontend:** Now you can update your frontend code (in `.env` or `config.js`) to point to `https://api.calview.me` instead of the raw EC2 IP.

---

## Step 7: Configure AWS for OIDC (Passwordless Auth)

Instead of using long-lived keys, we will configure AWS to trust GitHub Actions directly.

### 7.1 Add GitHub as an Identity Provider

1. Go to **IAM** → **Identity providers** → **Add provider**.
2. Select **OpenID Connect**.
3. **Provider URL**: `https://token.actions.githubusercontent.com`
5. **Audience**: `sts.amazonaws.com`
6. Click **Add provider**.

### 7.2 Create the IAM Role for Deployment

1. Go to **IAM** → **Roles** → **Create role**.
2. **Trusted entity type**: Select **Web identity**.
3. **Identity provider**: Select the provider you just created (`token.actions.githubusercontent.com`).
4. **Audience**: Select `sts.amazonaws.com`.
5. **GitHub organization**: Enter your GitHub username or the owner of the repository.
6. **GitHub repository**: Enter your repository name (e.g., `calview`).
    - *Note: This restricts access so ONLY this specific repo can deploy to your account.*
7. Click **Next**.
8. **Permissions**: Search for and select `AdministratorAccess` (or your specific deployment policies).
9. Click **Next**.
10. **Role name**: `GitHubActionsDeployRole`.
11. Click **Create role**.
12. **Copy the ARN**: Click on the new role and copy its **ARN** (e.g., `arn:aws:iam::<Account-ID>:role/GitHubActionsDeployRole`). You will need this for the secrets.

> For a detailed, step-by-step explanation of how GitHub Actions uses OIDC to access AWS resources, check out this guide on Qiita: [GitHub Actions with AWS](https://qiita.com/satooshi/items/0c2f5a0e2b64a1d9a4b3)  
---

## Step 8: Configure GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add the following secrets. **(Note: No AWS Access Keys are needed!)**

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `AWS_ROLE_TO_ASSUME` | `arn:aws:iam::...` | The Role ARN you copied in Step 7.2 |
| `AWS_REGION` | `us-east-1` | Your AWS Region |
| `S3_BUCKET_NAME` | `calview-frontend...` | Your S3 bucket name |
| `EC2_HOST` | `54.x.x.x` | Your EC2 Public IP |
| `EC2_USERNAME` | `ec2-user` | Default user for Amazon Linux |
| `EC2_SSH_KEY` | (Content of .pem file) | Private key for SSH access |
| `VITE_API_BASE_URL` | `https://api.calview.me` | Your Backend URL (use CloudFront URL if setup, or EC2 IP) |

You may also add other API keys as needed for testing, such as:
- VITE_GOOGLE_MAPS_API_KEY
- VITE_MAPBOX_TOKEN
- Any additional VITE_* or API_* keys required by your app

### How to copy your SSH Key correctly:

Run this command in your terminal to copy the key to your clipboard:

```bash
# MacOS
cat calview-key.pem | pbcopy

# Windows (Git Bash)
cat calview-key.pem | clip

# Linux
cat calview-key.pem | xclip -selection clipboard
```

---