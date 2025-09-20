const { con } = require("./mysql");

// Test connection and basic query
const testConnection = async () => {
    try {
        const [rows] = await con.query('SELECT 1 AS test');
        console.log('Test query result:', rows); // Should print: [{ test: 1 }]
    } catch (err) {
        console.error('Error executing test query:', err);
    }
};

// Function to find locked script IDs from the database
const findLockedScriptIds = async () => {
    const query = `
        SELECT DISTINCT locked_by 
        FROM sites 
        WHERE site_locked = true 
        AND locked_by IS NOT NULL;
    `;
    try {
        const [rows] = await con.query(query);
        
        // Log the raw result for better debugging
        console.log('Raw query result:', rows);

        // Check if rows is an object (single row) or an array
        if (!Array.isArray(rows)) {
            console.log('Single result returned:', rows);
            return [rows.locked_by]; // Wrap it in an array
        }
        
        if (rows.length === 0) {
            console.log('No locked scripts found.');
            return [];
        }

        // Return the mapped locked_by values from multiple rows
        return rows.map(row => row.locked_by);
    } catch (err) {
        console.error('Error finding locked script IDs:', err);
        return [];
    }
};

// Unlock all sites locked by the specified script ID
const unlockSitesByScriptId = async (scriptId) => {
    const unlockQuery = `
        UPDATE sites
        SET site_locked = false,
            locked_by = NULL
        WHERE locked_by = ?;
    `;
    try {
        const [result] = await con.query(unlockQuery, [scriptId]);
        console.log(`Unlocked all sites locked by ${scriptId}. Result:`, result);
    } catch (err) {
        console.error('Error unlocking sites:', err);
    }
};

// Main function to find and unlock sites
const unlockLockedSites = async () => {
    const scriptIds = await findLockedScriptIds();

    if (scriptIds.length > 0) {
        console.log('Found locked script IDs:', scriptIds);
        for (const scriptId of scriptIds) {
            // Unlock all sites for this script ID
            await unlockSitesByScriptId(scriptId);
        }
    } else {
        console.log('No locked script IDs found.');
    }
};

// Execute the test query to check the connection
testConnection().then(() => {
    // After the test query, execute the unlocking process
    unlockLockedSites();
});
