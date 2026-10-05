-- Keep booking approval separate from the kitchen and delivery workflow.
-- Existing CONFIRMED, IN_PROGRESS, READY_FOR_DELIVERY and DELIVERED values
-- remain valid; this adds the missing dispatch step between ready and complete.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY' AFTER 'READY_FOR_DELIVERY';
