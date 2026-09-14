# S3 study-material storage

New study-material attachments are uploaded by the backend to a private Amazon
S3 bucket. The database stores the stable `s3Key` and bucket metadata; API
responses generate short-lived signed download URLs. Existing Cloudinary
attachments remain readable during the migration.

Configure the backend with:

```env
AWS_REGION=ap-south-1
AWS_S3_BUCKET=eec-study-materials
AWS_ACCESS_KEY_ID=replace-me
AWS_SECRET_ACCESS_KEY=replace-me
```

The AWS SDK can also use the instance/task role or another standard AWS
credential provider instead of access-key environment variables. Keep the
bucket private and grant the backend identity only the required object access
under `schools/*/study-materials/*`.
