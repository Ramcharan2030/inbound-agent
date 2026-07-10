import asyncio
import os
import asyncio
import os
from dotenv import load_dotenv
from livekit import api

# Load environment variables
load_dotenv(".env")

def update_env_file(key: str, value: str):
    env_path = ".env"
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    updated = False
    for i, line in enumerate(lines):
        if line.strip().startswith(f"{key}="):
            lines[i] = f"{key}={value}\n"
            updated = True
            break
            
    if not updated:
        lines.append(f"\n{key}={value}\n")
        
    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

async def main():
    # Initialize LiveKit API
    # Credentials (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are auto-loaded from .env
    lkapi = api.LiveKitAPI()
    sip = lkapi.sip
    
    trunk_id = (
        os.getenv("SIP_TRUNK_ID")
        or os.getenv("OUTBOUND_TRUNK_ID")
        or os.getenv("SIP_OUTBOUND_TRUNK_ID")
    )
    address = os.getenv("VOBIZ_SIP_DOMAIN")
    username = os.getenv("VOBIZ_USERNAME")
    password = os.getenv("VOBIZ_PASSWORD")
    number = os.getenv("VOBIZ_OUTBOUND_NUMBER")
    
    if not trunk_id:
        print("Error: SIP_TRUNK_ID / OUTBOUND_TRUNK_ID not found in .env")
        return

    print(f"Syncing SIP Trunk: {trunk_id}")
    print(f"  Address: {address}")
    print(f"  Username: {username}")
    print(f"  Numbers: [{number}]")

    try:
        # 1. Attempt to update the existing trunk
        await sip.update_outbound_trunk_fields(
            trunk_id,
            address=address,
            auth_username=username,
            auth_password=password,
            numbers=[number] if number else [],
        )
        print(f"\nOK: SIP trunk {trunk_id} updated successfully.")
        
    except Exception as e:
        err_msg = str(e).lower()
        if "not found" in err_msg or "404" in err_msg or "no trunk" in err_msg:
            print(f"\nTrunk {trunk_id} not found on this server. Attempting to create a new one...")
            try:
                # 2. Fallback to create the trunk if it doesn't exist (omit the ID)
                create_fn = getattr(sip, "create_outbound_trunk", None) or getattr(sip, "create_sip_outbound_trunk", None)
                if not create_fn:
                    raise Exception("No creation method found on SIP client.")
                
                req_class = getattr(api, "CreateSIPOutboundTrunkRequest", None)
                trunk_class = getattr(api, "SIPOutboundTrunkInfo", None)
                
                req = req_class(
                    trunk=trunk_class(
                        name="Vobiz Outbound Trunk",
                        address=address,
                        auth_username=username,
                        auth_password=password,
                        numbers=[number] if number else [],
                    )
                )
                
                res = await create_fn(req)
                new_trunk_id = res.sip_trunk_id
                print(f"OK: SIP trunk created successfully with generated ID: {new_trunk_id}")
                
                # Update .env file
                update_env_file("SIP_TRUNK_ID", new_trunk_id)
                print(f"Updated .env file with SIP_TRUNK_ID={new_trunk_id}")
                
            except Exception as create_err:
                print(f"Failed to create trunk: {create_err}")
                raise e
        else:
            print(f"\nERROR: Failed to sync trunk: {e}")
    finally:
        await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
