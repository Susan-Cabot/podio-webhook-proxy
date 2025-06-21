exports.handler = async (event, context) => {
    console.log('🔔 Webhook recibido:', new Date().toISOString());
    console.log('📝 Method:', event.httpMethod);
    console.log('📝 Headers:', JSON.stringify(event.headers, null, 2));
    
    if (event.httpMethod !== 'POST') {
        console.log('❌ Método no permitido:', event.httpMethod);
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'text/plain' },
            body: 'Method Not Allowed'
        };
    }

    try {
        console.log('📝 Raw body:', event.body);
        const body = event.body;
        const params = new URLSearchParams(body);
        const data = Object.fromEntries(params);
        console.log('📊 Datos recibidos:', JSON.stringify(data, null, 2));

        // VERIFICACIÓN WEBHOOK
        if (params.get('type') === 'hook.verify') {
            const code = params.get('code');
            const hookId = params.get('hook_id');
            
            console.log('✅ VERIFICACIÓN solicitada');
            console.log('📝 Hook ID:', hookId);
            console.log('🔑 Código recibido:', code);
            
            const response = {
                statusCode: 200,
                headers: { 
                    'Content-Type': 'text/plain',
                    'Cache-Control': 'no-cache'
                },
                body: code
            };
            
            console.log('📤 Enviando respuesta:', JSON.stringify(response, null, 2));
            console.log('📤 Body de respuesta:', code);
            
            return response;
        }

        // DATOS REALES → MAKE
        console.log('📤 Reenviando datos reales a Make...');
        const makeUrl = 'https://hook.eu2.make.com/nisqpeb7yhi3b27jh6n215t7wap0jpc';
        
        const response = await fetch(makeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });

        console.log('📨 Respuesta de Make:', response.status, response.statusText);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/plain' },
            body: 'OK'
        };

    } catch (error) {
        console.error('💥 Error en webhook proxy:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/plain' },
            body: 'Internal Server Error'
        };
    }
};
