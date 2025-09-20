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
        const rows = await con.query(query);
        
        // Log the raw result for better debugging
        console.log('Raw query result:', rows);
        
        // Fix: MySQL module returns results in different formats depending on version
        // Let's handle both array and object formats safely
        let resultArray = rows;
        
        // If rows is an array with the first element containing the actual results
        if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0])) {
            resultArray = rows[0];
        }
        
        // Handle empty results
        if (!resultArray || resultArray.length === 0) {
            console.log('No locked scripts found.');
            return [];
        }
        
        // If it's a single object (not in an array)
        if (!Array.isArray(resultArray) && resultArray.locked_by) {
            console.log('Single result returned:', resultArray);
            return [resultArray.locked_by];
        }
        
        // Extract all locked_by values safely
        const scriptIds = Array.isArray(resultArray) 
            ? resultArray.map(row => row.locked_by).filter(id => id)
            : [];
            
        console.log(`Found ${scriptIds.length} locked script IDs:`, scriptIds);
        return scriptIds;
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
        // Fix: Handle different return formats from the query
        const result = await con.query(unlockQuery, [scriptId]);
        
        // Get the actual result object, which might be in different positions based on MySQL library
        let affectedRows = 0;
        if (Array.isArray(result) && result.length > 0) {
            if (result[0].affectedRows) {
                // Standard MySQL library format
                affectedRows = result[0].affectedRows;
            } else if (Array.isArray(result[0]) && result[0].length > 0 && result[0][0].affectedRows) {
                // Alternative format sometimes returned
                affectedRows = result[0][0].affectedRows;
            }
        }
        
        console.log(`Unlocked ${affectedRows} sites locked by script ID ${scriptId}`);
    } catch (err) {
        console.error(`Error unlocking sites for script ID ${scriptId}:`, err);
    }
};

// Unlock all sites in a single query
const unlockAllSites = async () => {
    const unlockAllQuery = `
        UPDATE sites
        SET site_locked = false,
            locked_by = NULL
        WHERE site_locked = true AND locked_by IS NOT NULL;
    `;
    try {
        const result = await con.query(unlockAllQuery);
        
        // Get the actual result object, which might be in different positions
        let affectedRows = 0;
        if (Array.isArray(result) && result.length > 0) {
            if (result[0].affectedRows) {
                affectedRows = result[0].affectedRows;
            } else if (Array.isArray(result[0]) && result[0].length > 0 && result[0][0].affectedRows) {
                affectedRows = result[0][0].affectedRows;
            }
        }
        
        console.log(`Unlocked all ${affectedRows} locked sites in a single operation.`);
        return affectedRows;
    } catch (err) {
        console.error('Error unlocking all sites:', err);
        return 0;
    }
};

// Main function to find and unlock sites
const unlockLockedSites = async () => {
    // First try to get all script IDs for informational purposes
    const scriptIds = await findLockedScriptIds();

    if (scriptIds.length > 0) {
        console.log('Found locked script IDs:', scriptIds);
        
        // OPTION 1: Unlock script by script (for detailed logging)
        console.log('Processing unlock for each script ID individually:');
        for (const scriptId of scriptIds) {
            await unlockSitesByScriptId(scriptId);
        }
        
        // OPTION 2: Or unlock all at once (more efficient)
        console.log('Performing complete unlock of all sites in a single operation:');
        const totalUnlocked = await unlockAllSites();
        
        console.log(`Successfully processed ${scriptIds.length} script IDs and unlocked all associated sites.`);
    } else {
        console.log('No locked script IDs found.');
    }
};

// Execute the test query to check the connection
testConnection().then(() => {
    // After the test query, execute the unlocking process
    unlockLockedSites();
});
