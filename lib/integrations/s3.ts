import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const getS3Client = () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET_NAME) {
        throw new Error("AWS credentials or bucket name missing from environment variables")
    }

    return new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    })
}

export const s3 = {
    /**
     * Generates a presigned URL for uploading a file to S3.
     * @param key The key (path) where the file will be stored
     * @param contentType The MIME type of the file
     * @param expiresInSeconds Duration in seconds before the URL expires (default 60)
     * @returns Object containing the uploadUrl and the final publicUrl
     */
    getPresignedUploadUrl: async (key: string, contentType: string, expiresInSeconds = 60) => {
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        })

        const client = getS3Client()
        const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds })
        const publicUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`

        return { uploadUrl, publicUrl }
    },

    /**
     * Deletes a file from S3.
     * @param key The key (path) of the file to delete
     */
    deleteFile: async (key: string) => {
        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
        })

        const client = getS3Client()
        await client.send(command)
    },
}
