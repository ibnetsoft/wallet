-- 1. Create Activation and Roll-up trigger function
CREATE OR REPLACE FUNCTION public.handle_user_activation()
RETURNS TRIGGER AS $$
DECLARE
    v_seq INT;
    v_grand_sponsor UUID;
BEGIN
    -- Only trigger when status transitions from 'PENDING' to 'ACTIVE'
    IF NEW.status = 'ACTIVE' AND (OLD.status IS NULL OR OLD.status = 'PENDING') THEN
        
        -- If user has a direct referrer (recommender_id)
        IF NEW.recommender_id IS NOT NULL THEN
            
            -- Calculate the exact referral sequence number for this ACTIVE user
            -- by counting how many ACTIVE users the recommender already has
            SELECT COUNT(*) INTO v_seq
            FROM public.users
            WHERE recommender_id = NEW.recommender_id
              AND status = 'ACTIVE'
              AND id != NEW.id;
              
            v_seq := v_seq + 1;
            NEW.referral_seq := v_seq;

            -- Check if this is a 3-배수 (3, 6, 9, 12...) referral
            IF v_seq % 3 = 0 THEN
                -- Roll-up: set sponsor_id to recommender's own sponsor_id (grandparent)
                SELECT sponsor_id INTO v_grand_sponsor 
                FROM public.users 
                WHERE id = NEW.recommender_id;
                
                -- If grandparent exists, roll up. Otherwise, stay with recommender.
                NEW.sponsor_id := COALESCE(v_grand_sponsor, NEW.recommender_id);
            ELSE
                -- Normal: set sponsor_id to the recommender
                NEW.sponsor_id := NEW.recommender_id;
            END IF;
            
        ELSE
            -- No recommender: Top-level node
            NEW.sponsor_id := NULL;
            NEW.referral_seq := 0;
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind BEFORE UPDATE trigger on public.users
DROP TRIGGER IF EXISTS trg_user_activation ON public.users;
CREATE TRIGGER trg_user_activation
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_activation();
