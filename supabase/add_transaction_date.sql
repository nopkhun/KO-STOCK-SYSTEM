-- Migration: Add transaction_date column to transactions table
-- Run this in Supabase SQL Editor before deploying the updated code

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date DATE;

-- Optional: backfill existing rows with created_at date
-- UPDATE transactions SET transaction_date = created_at::date WHERE transaction_date IS NULL;
