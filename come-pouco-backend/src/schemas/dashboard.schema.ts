import { z } from 'zod';

import { optionalPositiveIdQuerySchema, optionalPositiveIntegerQuerySchema } from './common.schema';

const dashboardRangeSchema = z.enum(['7d', '30d', '90d']).default('7d');
const dashboardBucketSchema = z.enum(['day', 'hour']).default('day');

const conversionDashboardQuerySchema = z.object({
  range: dashboardRangeSchema,
  employeeId: optionalPositiveIdQuerySchema('employeeId')
});

const conversionTopProductsQuerySchema = conversionDashboardQuerySchema.extend({
  limit: optionalPositiveIntegerQuerySchema('limit', 10, 50)
});

const conversionTimelineQuerySchema = conversionDashboardQuerySchema.extend({
  bucket: dashboardBucketSchema
});

type ConversionDashboardQuery = z.infer<typeof conversionDashboardQuerySchema>;
type ConversionTopProductsQuery = z.infer<typeof conversionTopProductsQuerySchema>;
type ConversionTimelineQuery = z.infer<typeof conversionTimelineQuerySchema>;

export {
  conversionDashboardQuerySchema,
  conversionTimelineQuerySchema,
  conversionTopProductsQuerySchema
};
export type { ConversionDashboardQuery, ConversionTimelineQuery, ConversionTopProductsQuery };
