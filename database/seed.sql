-- Seed data for Burma Meat Point Database

-- 1. Create Admin
INSERT INTO core_user (email, password, name, role, is_active, is_staff, is_superuser, date_joined, status) 
VALUES ('admin@burmameat.com', 'pbkdf2_sha256$600000$xxxx', 'System Admin', 'Admin', true, true, true, NOW(), 'Active');

-- 2. Create Vendors
INSERT INTO core_user (email, password, name, phone, role, is_active, is_vendor_approved, date_joined, status)
VALUES 
('vendor1@test.com', 'pbkdf2_sha256$600000$xxxx', 'John Vendor', '+254711111111', 'Vendor', true, true, NOW(), 'Active'),
('vendor2@test.com', 'pbkdf2_sha256$600000$xxxx', 'Jane Butcher', '+254722222222', 'Vendor', true, true, NOW(), 'Active');

-- 3. Create Consumers
INSERT INTO core_user (email, password, name, phone, role, is_active, date_joined, status)
VALUES 
('consumer1@test.com', 'pbkdf2_sha256$600000$xxxx', 'Alice Smith', '+254733333333', 'Consumer', true, NOW(), 'Active'),
('consumer2@test.com', 'pbkdf2_sha256$600000$xxxx', 'Bob Johnson', '+254744444444', 'Consumer', true, NOW(), 'Active');

-- 4. Create Vendor Details (Linking to users 2 and 3)
INSERT INTO core_vendordetails (vendor_id, shop_name, location, kebs_license, meat_types, price_range, description, hygiene_score, freshness_score, service_score, overall_score, total_ratings)
VALUES
(2, 'Johns Fresh Meats', 'Stall B4, Burma Market', 'KEBS-1002', 'Beef, Mutton', 'Ksh 500 - 800 / Kg', 'Providing the best fresh beef straight from the slaughterhouse.', 4.5, 4.8, 4.2, 4.5, 5),
(3, 'Janes Halal Butchery', 'Stall C1, Burma Market', 'KEBS-8891', 'Goat, Chicken', 'Ksh 600 - 900 / Kg', 'Certified Halal meats with focus on cleanliness.', 4.9, 4.6, 4.8, 4.8, 8);

-- 5. Add Ratings (Assuming Vendor 2 gets rated by Consumers 4 and 5)
INSERT INTO core_rating (vendor_id, consumer_id, anonymous_mode, hygiene_score, freshness_score, service_score, comment)
VALUES
(2, 4, false, 5, 5, 4, 'Great meat but area was a bit crowded.'),
(2, 5, false, 4, 4, 4, 'Good value for money.'),
(3, 4, true, 5, 5, 5, 'Super clean and very friendly service!');

-- 6. Add Vendor Reply
-- Gets the rating ID of the first rating
INSERT INTO core_vendorreply (rating_id, reply_text) 
VALUES (1, 'Thank you for your feedback! We will try to manage the crowd better.');

-- 7. Add Favorite
INSERT INTO core_favorite (consumer_id, vendor_id) 
VALUES (4, 3);
