-- Update quotes and state_rules to use the new post-Oct-2021 composite GST rate of 13.8%

ALTER TABLE quotes ALTER COLUMN gst_output_rate SET DEFAULT 0.138;
ALTER TABLE state_rules ALTER COLUMN gst_on_output SET DEFAULT 0.13800;
