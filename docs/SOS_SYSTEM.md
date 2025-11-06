# SOS / Emergency Button System

## Overview

The SOS system allows drivers to trigger emergency alerts with location tracking and provides an operations console for incident management.

## Features

### Driver Interface (`/driver`)
- **Hold-to-trigger SOS button**: 3-second countdown prevents false alarms
- **Hazard types**: accident, medical, robbery, breakdown, other
- **Optional note**: Drivers can add context
- **Auto-position updates**: Location updated every 30 seconds for 10 minutes while SOS is active
- **Status tracking**: Shows current SOS status (Open/Acknowledged/Resolved)
- **Cancel option**: Drivers can cancel open SOS events

### Operations Console (`/ops/incidents`)
- **Live incident list**: All SOS events sorted by status and time
- **Map view**: Real-time location of all incidents
- **Color-coded markers**:
  - Red (pulsing): Open incidents
  - Yellow: Acknowledged
  - Green: Resolved
- **Acknowledge workflow**: Admins can acknowledge to indicate they're responding
- **Resolve workflow**: Admins can resolve with notes

## Database Schema

### Tables

1. **user_roles**: Role-based access control
   - `admin`: Full access to ops console
   - `driver`: Can create SOS events
   - `user`: Basic access
   - `moderator`: Future use

2. **sos_events**: Emergency incidents
   - Tracks location, hazard type, status, timestamps
   - RLS: Drivers see own, admins see all

3. **sos_position_updates**: Location tracking during active SOS
   - Auto-updated every 30 seconds for 10 minutes
   - Linked to parent SOS event

### Security

- **RLS policies**: Drivers can only view/create their own SOS; admins see all
- **Security definer function**: `has_role()` prevents RLS recursion
- **No client-side role checks**: All authorization server-side

## Granting Admin Access

To grant admin access to a user, insert into the `user_roles` table:

```sql
-- Get user ID from Supabase Auth dashboard, then:
insert into public.user_roles (user_id, role) 
values ('USER_UUID_HERE', 'admin');
```

## Notifications

The `sos-dispatch` edge function handles notifications:
- **On SOS creation**: Notifies all admins
- **On acknowledge**: Notifies the driver
- **On resolve**: Notifies the driver

To enable push notifications, configure FCM_SERVER_KEY in edge function secrets.

## Testing

1. **Create admin user**:
   ```sql
   insert into public.user_roles (user_id, role) 
   values ('your-user-id', 'admin');
   ```

2. **Test as driver**:
   - Go to `/driver`
   - Hold the red button for 3 seconds
   - Fill in hazard details and submit

3. **Test as ops**:
   - Go to `/ops/incidents`
   - See the SOS on map and list
   - Click to acknowledge, then resolve

## Auto-Position Updates

When an SOS is created, the driver's position is automatically updated every 30 seconds for 10 minutes (20 total updates). This allows ops to track the driver's movement during the emergency.

Position updates are stored in `sos_position_updates` table and can be viewed by admins.

## Future Enhancements

- Photo upload with incident
- Two-way chat between driver and ops
- Incident history and analytics
- Custom notification templates
- SMS/Email fallback for push notifications
