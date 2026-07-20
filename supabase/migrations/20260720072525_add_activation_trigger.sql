-- 1. Create Activation and Roll-up trigger function
CREATE OR REPLACE FUNCTION public.handle_user_activation()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_referral_count INT;
    v_grandparent_id UUID;
BEGIN
    -- Only trigger when status transitions from 'PENDING' to 'ACTIVE'
    IF NEW.status = 'ACTIVE' AND (OLD.status IS NULL OR OLD.status = 'PENDING') THEN
        
        -- If user has a direct referrer (parent_id)
        IF NEW.parent_id IS NOT NULL THEN
            
            -- Increment the referral_count of the sponsor (obtaining row lock to prevent race conditions)
            UPDATE public.users 
            SET referral_count = referral_count + 1 
            WHERE id = NEW.parent_id
            RETURNING referral_count INTO v_parent_referral_count;

            -- Check if this is a 3-배수 (3, 6, 9, 12...) referral
            IF v_parent_referral_count % 3 = 0 THEN
                -- Roll-up: set placement_id to sponsor's own placement_id (B's sponsor / grandparent)
                SELECT placement_id INTO v_grandparent_id 
                FROM public.users 
                WHERE id = NEW.parent_id;
                
                NEW.placement_id := v_grandparent_id;
            ELSE
                -- Normal: set placement_id to the sponsor (parent_id)
                NEW.placement_id := NEW.parent_id;
            END IF;
            
        ELSE
            -- No sponsor: Top-level node
            NEW.placement_id := NULL;
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind BEFORE UPDATE trigger on public.users
CREATE TRIGGER trg_user_activation
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_activation();
