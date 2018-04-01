function objectFromSerializedArray(arr){
	var obj = {};
	for (var i = 0; i < arr.length; i++){
		obj[arr[i]['name']] = arr[i]['value'];
	}

	return obj;
}

function log(item){
	try {
		console.log(item);
	}
	catch (e){
		//
	}
}

$(function(){
	$('form.js-post').submit(function(e){
		const classNote = 'js-note';

		function addNote($form, text){
			$form.append('<p class="'+classNote+'">'+text+'</p>');
		}

		e.preventDefault();
		var $form = $(this),
		 url = $form.data('action');

		$form.find('.'+classNote).remove();

		if (!url){
			addNote($form, 'Error: no url set');
			return;
		}

		var data = objectFromSerializedArray($form.serializeArray());

		$.ajax({
			url: url,
			method: $form.attr('method'),
			data: data,
			dataType: 'text',
			success: function(response){
				log(response);
				try {
					data = JSON.parse(response);

					addNote($form, 'Saved: <a href="'+data.file+'" target="_blank" title="This will open in a new tab">view</a>');
				}
				catch (e){
					addNote($form, 'Saved');
				}
			},
			error: function(jqXHR){
				log('Error: '+jqXHR.responseText);
				try {
					error = JSON.parse(jqXHR.responseText).error;
				}
				catch (e){
					error = 'unknown error';
				}
				addNote($form, 'Error: '+error);
			}
		});
	});
});