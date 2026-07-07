import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join, resolve } from 'node:path';

const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class StorageService {
  private readonly localDirectory = resolve('.local-uploads/images');
  private readonly legacyMenuDirectory = resolve('.local-uploads/menu');

  constructor(private readonly config: ConfigService) {}

  async uploadImage(file?: UploadedImage) {
    if (!file) throw new BadRequestException('Image file is required');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('Image must be 5 MB or smaller');
    const extension = allowedTypes.get(file.mimetype);
    if (!extension || !this.matchesMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'Only valid JPEG, PNG, and WebP images are allowed',
      );
    }

    const objectName = `images/${randomUUID()}${extension}`;
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucketName = this.config.get<string>('R2_BUCKET_NAME');
    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');

    if (
      accountId &&
      accessKeyId &&
      secretAccessKey &&
      bucketName &&
      publicBaseUrl
    ) {
      const storage = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      await storage.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectName,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return {
        objectName,
        url: `${publicBaseUrl.replace(/\/$/, '')}/${objectName}`,
        provider: 'cloudflare-r2',
      };
    }

    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException(
        'Cloudflare R2 storage is not configured',
      );
    }

    await fs.mkdir(this.localDirectory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await fs.writeFile(join(this.localDirectory, filename), file.buffer, {
      flag: 'wx',
    });
    return {
      objectName: `images/${filename}`,
      url: `${this.config.get<string>('API_PUBLIC_URL', 'http://localhost:4000')}/uploads/images/${filename}`,
      provider: 'local',
    };
  }

  localFile(filename: string) {
    return this.fileFromDirectory(this.localDirectory, filename);
  }

  legacyMenuFile(filename: string) {
    return this.fileFromDirectory(this.legacyMenuDirectory, filename);
  }

  private async fileFromDirectory(directory: string, filename: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeName || extname(safeName) === '')
      throw new NotFoundException('Image not found');
    const path = join(directory, safeName);
    try {
      await fs.access(path);
    } catch {
      throw new NotFoundException('Image not found');
    }
    return createReadStream(path);
  }

  private matchesMagicBytes(buffer: Buffer, mimeType: string) {
    if (mimeType === 'image/jpeg')
      return buffer[0] === 0xff && buffer[1] === 0xd8;
    if (mimeType === 'image/png')
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mimeType === 'image/webp') {
      return (
        buffer.subarray(0, 4).toString() === 'RIFF' &&
        buffer.subarray(8, 12).toString() === 'WEBP'
      );
    }
    return false;
  }
}
