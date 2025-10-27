import Handlebars from 'handlebars';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@auth/shared';

export class TemplateService {
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, '../templates');
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // Register custom Handlebars helpers
    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
  }

  async render(templateName: string, variables: Record<string, any>): Promise<string> {
    try {
      const template = await this.getTemplate(templateName, 'html');
      return template(variables);
    } catch (error) {
      logger.error('Failed to render template', { templateName, error });
      throw error;
    }
  }

  async renderText(templateName: string, variables: Record<string, any>): Promise<string> {
    try {
      const template = await this.getTemplate(templateName, 'txt');
      return template(variables);
    } catch (error) {
      // If text template doesn't exist, return empty string
      logger.warn('Text template not found, using empty string', { templateName });
      return '';
    }
  }

  private async getTemplate(
    templateName: string,
    format: 'html' | 'txt'
  ): Promise<HandlebarsTemplateDelegate> {
    const cacheKey = `${templateName}.${format}`;

    // Check cache
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    // Load template from file
    const templatePath = path.join(this.templatesDir, `${templateName}.${format}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');

    // Compile template
    const compiled = Handlebars.compile(templateContent);

    // Cache compiled template
    this.templateCache.set(cacheKey, compiled);

    return compiled;
  }

  clearCache(): void {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }
}
