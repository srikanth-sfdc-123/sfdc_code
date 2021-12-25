({
	invoke: function(component, event, helper) {
        var searchText = component.get("v.industry");
        var action=component.get("c.getData");
        action.setParams({industry:searchText});
        action.setCallback(this,function(response){
        var state=response.getState();
        if(state === 'SUCCESS'){
            console.log(response.getReturnValue());
            component.set("v.myAccounts",response.getReturnValue());
        }else{
            console.log('Error');
        }
        });
        $A.enqueueAction(action);
		
	}
})