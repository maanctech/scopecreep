ALTER TABLE users ADD COLUMN clerk_user_id text UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE organizations ADD COLUMN clerk_organization_id text UNIQUE;

CREATE INDEX users_clerk_idx ON users(clerk_user_id) WHERE clerk_user_id IS NOT NULL;
CREATE INDEX organizations_clerk_idx ON organizations(clerk_organization_id) WHERE clerk_organization_id IS NOT NULL;
