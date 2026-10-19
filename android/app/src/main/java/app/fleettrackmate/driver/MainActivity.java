package app.fleettrackmate.driver;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import app.fleettrackmate.driver.tracking.NativeTrackerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugin: native recording and upload of the driver's position,
        // so tracking survives the WebView being frozen in the background.
        registerPlugin(NativeTrackerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
