import { z } from 'zod';

export const approveSchema = z.object({ approved: z.boolean() });
export type ApproveDto = z.infer<typeof approveSchema>;
