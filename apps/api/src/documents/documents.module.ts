import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Env } from '../config/env';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalDiskStorage } from './storage/local-disk.storage';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    // Files are buffered in memory (max MAX_UPLOAD_MB) so the type can be sniffed and a
    // thumbnail rendered before anything is written to storage.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: Math.floor(config.get('MAX_UPLOAD_MB', { infer: true }) * 1024 * 1024),
          files: 1,
          fields: 30,
          fieldSize: 64 * 1024,
        },
        // Browsers send UTF-8 file names (Hebrew / Arabic) without a charset parameter.
        defParamCharset: 'utf8',
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const storage = new LocalDiskStorage(config.get('UPLOAD_DIR', { infer: true }));
        storage.ensureRoot();
        new Logger('StorageService').log(`Uploads stored in ${storage.root}`);
        return storage;
      },
    },
  ],
  exports: [DocumentsService, StorageService],
})
export class DocumentsModule {}
