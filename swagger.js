const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MedAI Vision API',
      version: '1.1.0',
      description: 'API مدیریت تست‌های پزشکی و سیستم صف هوشمند',
      contact: {
        name: 'MedAI Vision Support',
        email: 'support@medai.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:8889/api',
        description: 'Development server'
      },
      {
        url: 'https://api.medai.com/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'توکن JWT دریافتی از endpoint های احراز هویت'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'پیام خطا'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            phone: {
              type: 'string',
              example: '09121234567'
            },
            name: {
              type: 'string',
              example: 'علی احمدی'
            },
            national_id: {
              type: 'string',
              example: '1234567890'
            },
            age: {
              type: 'integer',
              example: 30
            },
            role: {
              type: 'string',
              enum: ['patient', 'doctor', 'admin'],
              example: 'patient'
            },
            is_verified: {
              type: 'boolean',
              example: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Test: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            patient_id: {
              type: 'integer',
              example: 1
            },
            doctor_id: {
              type: 'integer',
              nullable: true,
              example: 2
            },
            image_path: {
              type: 'string',
              example: 'uploads/test_123.jpg'
            },
            description: {
              type: 'string',
              example: 'آزمایش خون'
            },
            ai_result: {
              type: 'string',
              description: 'JSON string حاوی نتیجه تحلیل هوش مصنوعی'
            },
            status: {
              type: 'string',
              enum: ['pending', 'processed', 'urgent'],
              example: 'processed'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Queue: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            doctor_id: {
              type: 'integer',
              example: 2
            },
            date: {
              type: 'string',
              format: 'date',
              example: '2025-11-15'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        QueueItem: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            queue_id: {
              type: 'integer',
              example: 1
            },
            appointment_id: {
              type: 'integer',
              nullable: true,
              example: 5
            },
            patient_id: {
              type: 'integer',
              example: 3
            },
            patient_name: {
              type: 'string',
              example: 'محمد رضایی'
            },
            patient_phone: {
              type: 'string',
              example: '09121111111'
            },
            position: {
              type: 'integer',
              example: 1,
              description: 'موقعیت در صف'
            },
            expected_duration_minutes: {
              type: 'integer',
              example: 10,
              description: 'مدت زمان پیش‌بینی شده (دقیقه)'
            },
            estimated_start_at: {
              type: 'string',
              format: 'date-time',
              description: 'زمان تخمینی شروع'
            },
            estimated_end_at: {
              type: 'string',
              format: 'date-time',
              description: 'زمان تخمینی پایان'
            },
            status: {
              type: 'string',
              enum: ['waiting', 'in_progress', 'done', 'skipped', 'cancelled'],
              example: 'waiting'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        DoctorSettings: {
          type: 'object',
          properties: {
            doctor_id: {
              type: 'integer',
              example: 2
            },
            default_duration_minutes: {
              type: 'integer',
              example: 8,
              description: 'مدت زمان پیش‌فرض هر ویزیت (دقیقه)'
            },
            buffer_before_minutes: {
              type: 'integer',
              example: 0,
              description: 'زمان بافر قبل از ویزیت (دقیقه)'
            },
            buffer_after_minutes: {
              type: 'integer',
              example: 2,
              description: 'زمان بافر بعد از ویزیت (دقیقه)'
            },
            allow_overflow: {
              type: 'boolean',
              example: false,
              description: 'اجازه تجمع بیماران'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'توکن ارائه نشده یا نامعتبر است',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'توکن نامعتبر'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'دسترسی غیرمجاز',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'دسترسی غیرمجاز'
              }
            }
          }
        },
        NotFoundError: {
          description: 'رکورد یافت نشد',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'رکورد یافت نشد'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'احراز هویت با OTP و JWT'
      },
      {
        name: 'Users',
        description: 'مدیریت کاربران'
      },
      {
        name: 'Tests',
        description: 'مدیریت تست‌های پزشکی'
      },
      {
        name: 'Queue',
        description: 'سیستم صف و نوبت‌دهی هوشمند'
      },
      {
        name: 'Admin',
        description: 'پنل مدیریت'
      },
      {
        name: 'Analytics',
        description: 'آنالیز و گزارش‌گیری'
      }
    ]
  },
  apis: ['./src/routes/*.js', './swagger-docs/*.yaml']
};

const specs = swaggerJsdoc(options);

module.exports = specs;
